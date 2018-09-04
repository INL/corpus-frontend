import * as $ from 'jquery';
import * as URI from 'urijs';
import Vue from 'vue';
import Vuex from 'vuex';

import * as BLTypes from '../../types/blacklabtypes';

import {getStoreBuilder} from 'vuex-typex';

import {FilterField, PropertyField} from '../../types/pagetypes';
import {makeRegexWildcard, makeWildcardRegex} from '../../utils';
import parseCql from '../../utils/cqlparser';
import parseLucene from '../../utils/lucene2filterparser';
import { debugLog } from '../../utils/debug';

Vue.use(Vuex);

const enum defaults {
	pageSize = 20,
	wordsAroundHit = 3,
	sampleMode = 'percentage'
}

/** All unknown/unspecified properties must be initialized to null to enable state reactivity */
type PageState = {
	filters: {[key: string]: FilterField};
	hitDisplaySettings: SearchDisplaySettings;
	docDisplaySettings: SearchDisplaySettings;
	/** More of a display mode on the results */
	operation: 'hits'|'docs'|null;
	pageSize: number;
	pattern: {[key: string]: PropertyField|undefined};
	patternString: string|null;
	patternQuerybuilder: string|null;
	sampleMode: 'percentage'|'count';
	sampleSeed: number|null;
	sampleSize: number|null;
	within: string|null;
	wordsAroundHit: number|null;
};

interface SearchDisplaySettings {
	/** case-sentive grouping */
	caseSentive: boolean;
	groupBy: string[];
	sort: string|null;
	page: number;
	viewGroup: string|null;
}

/** Decode the current url into a valid page state configuration. Keep everything private except the getters */
class UrlPageState implements PageState {
	/**
	 * Path segments of the url this was constructed with, typically something like [corpusname, 'search', ('docs'|'hits')?]
	 * But might contain extra leading segments if the application is proxied.
	 */
	private paths: string[];
	/** Query parameters parsed into an object, repeated fields are turned into an array, though all values are kept as-is as strings */
	private params: {[key: string]: string|string[]|null};

	constructor(uri = new URI()) {
		this.paths = uri.segmentCoded();
		this.params = uri.search(true);
	}

	get filters(): {[key: string]: FilterField} {
		const luceneString = this.getString('filter', null, v=>v?v:null);
		if (luceneString == null) {
			return {};
		}
		try {
			return parseLucene(luceneString).reduce((acc, v) => {acc[v.name] = v; return acc;}, {});
		} catch (error) {
			debugLog('Cannot decode lucene query ', luceneString, error);
			return {};
		}
	}

	get operation(): 'hits'|'docs'|null {
		const path = this.paths.length ? this.paths[this.paths.length-1].toLowerCase() : null;
		if (path !== 'hits' && path !== 'docs') {
			return null;
		} else {
			return path;
		}
	}

	get pageSize(): number {
		return this.getNumber('number', defaults.pageSize, v => [20,50,100,200].includes(v) ? v : defaults.pageSize)!;
	}

	get pattern(): {[key: string]: PropertyField} {
		function isCase(value) { return value.startsWith('(?-i)') || value.startsWith('(?c)'); }
		function stripCase(value) { return value.substr(value.startsWith('(?-i)') ? 5 : 4); }

		const pattString = this.getString('patt', null, v=>v?v:null);
		if (pattString == null) {
			return {};
		}
		try {
			const result = parseCql(pattString);

			/**
			 * A requirement of the PropertyFields is that there are no gaps in the values
			 * So a valid config is
			 * ```
			 * lemma: [these, are, words]
			 * word: [these, are, other, words]
			 * ```
			 * And an invalid config is
			 * ```
			 * lemma: [gaps, are, , not, allowed]
			 * ```
			 * Not all properties need to have the same number of values though,
			 * shorter lists are implicitly treated as having wildcards for the remainder of values. (see getPatternString())
			 *
			 * Store the values here while parsing.
			 */
			const attributeValues: {[key: string]: string[]} = {};
			for (let i = 0; i < result.tokens.length; ++i) {
				const token = result.tokens[i];
				if (token.leadingXmlTag || token.optional || token.repeats || token.trailingXmlTag) {
					throw new Error('Token contains settings too complex for simple search');
				}

				// Use a stack instead of direct recursion to simplify code
				const stack = [token.expression];
				while (stack.length) {
					const expr = stack.shift()!;
					if (expr.type === 'attribute') {
						const name = expr.name;
						const values = attributeValues[name] = attributeValues[name] || [];
						if (expr.operator !== '=') {
							throw new Error('Unsupported comparator, only "=" is supported.');
						}
						if (values.length !== i) {
							throw new Error('Duplicate or missing values on property');
						}
						values.push(expr.value);
					} else if (expr.type === 'binaryOp') {
						if (!(expr.operator === '&' || expr.operator === 'AND')) {
							throw new Error('Multiple properties on token must use AND operator');
						}

						stack.push(expr.left, expr.right);
					}
				}
			}

			/*
			 * Build the actual PropertyFields.
			 * Convert from regex back into pattern globs, extract case sensitivity.
			 */
			return Object.entries(attributeValues).map(([key, values]) => {
				const caseSensitive = values.every(isCase);
				if (caseSensitive) {
					values = values.map(stripCase);
				}
				return {
					name: key,
					case: caseSensitive,
					value: makeRegexWildcard(values.join(' '))
				} as PropertyField;
			})
			.reduce((acc, v) => {acc[v.name] = v; return acc;}, {});
		} catch (error) {
			debugLog('Could not parse cql query', error);
			return {};
		}
	}

	get patternString(): string|null {
		return this.getString('patt', null, v => v?v:null);
	}

	get patternQuerybuilder(): string|null {
		return this.patternString;
	}

	get sampleMode(): 'count'|'percentage' {
		// If 'sample' exists we're in count mode, otherwise if 'samplenum' (and is valid), we're in percent mode
		// ('sample' also has precendence for the purposes of determining samplesize)
		if (this.getNumber('sample') != null) {
			return 'count';
		} else if (this.getNumber('samplemode', null, v => (v != null && (v >= 0 && v <=100)) ? v : null) != null) {
			return 'percentage';
		} else {
			return defaults.sampleMode;
		}
	}

	get sampleSeed(): number|null {
		return this.getNumber('sampleseed', null);
	}

	get sampleSize(): number|null {
		// Use 'sample' unless missing, then use 'samplenum', if 0-100 (as it's percentage-based)
		return this.getNumber('sample', this.getNumber('samplenum', null, v => (v >= 0 && v <=100) ? v : null));
	}

	// TODO these might become dynamic in the future, then we need extra manual checking
	get within(): 'p'|'s'|null {
		return null; // TODO
	}

	get wordsAroundHit(): number {
		return this.getNumber('wordsaroundhit', defaults.wordsAroundHit, v => v >= 0 && v <= 10 ? v : defaults.wordsAroundHit)!;
	}

	get hitDisplaySettings(): SearchDisplaySettings {
		if (this.operation !== 'hits') {
			// not the active view, use default/uninitialized settings
			return {
				caseSentive: false,
				groupBy: [],
				sort: null,
				viewGroup: null,
				page: 0,
			};
		} else {
			const groupBy = this.getString('group', '')!
			.split(',')
			.map(g => g.trim())
			.filter(g => !!g);

			return {
				groupBy,
				caseSentive: groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', null, v => v?v:null),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:null),
				page: this.getNumber('start', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */)!,
			};
		}
	}

	get docDisplaySettings(): SearchDisplaySettings {
		if(this.operation !== 'docs') {
			return {
				caseSentive: false,
				groupBy: [],
				sort: null,
				viewGroup: null,
				page: 0,
			};
		} else {
			const groupBy = this.getString('group', '')!
			.split(',')
			.map(g => g.trim())
			.filter(g => !!g);

			return {
				groupBy,
				caseSentive: groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', null, v => v?v:null),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:null),
				page: this.getNumber('start', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */)!,
			};
		}
	}

	public get(): PageState {
		return {
			docDisplaySettings: this.docDisplaySettings,
			filters: this.filters,
			hitDisplaySettings: this.hitDisplaySettings,
			operation: this.operation,
			pageSize: this.pageSize,
			pattern: this.pattern,
			patternString: this.patternString,
			patternQuerybuilder: this.patternQuerybuilder,
			sampleMode: this.sampleMode,
			sampleSeed: this.sampleSeed,
			sampleSize: this.sampleSize,
			within: this.within,
			wordsAroundHit: this.wordsAroundHit
		};
	}

	/**
	 * Get the parameter by the name of paramname from our query parameters.
	 * If the parameter is missing or is NaN, the fallback will be returned,
	 * otherwise, the parameter is passed to the validate function (if present), and the result is returned.
	 */
	private getNumber(paramname: string, fallback: number|null = null, validate?: (value: number)=>number|null): number|null {
		const {[paramname]: prop} = this.params;
		if (typeof prop !== 'string') {
			return fallback;
		}
		const val = Number.parseInt(prop, 10);
		if (isNaN(val)) {
			return fallback;
		}
		return validate ? validate(val) : val;
	}
	/**
	 * Get the parameter by the name of paramname from our query parameters.
	 * If the parameter is missing, the fallback will be returned,
	 * otherwise, the parameter is passed to the validate function (if present), and the result is returned.
	 * NOTE: empty strings are preserved and need to removed using the validation function if needed.
	 */
	private getString(paramname: string, fallback: string|null = null, validate?: (value: string)=>string|null): string|null {
		const {[paramname]: prop} = this.params;
		if (typeof prop !== 'string') {
			return fallback;
		}
		return validate ? validate(prop) : prop;
	}
	/** If the property is missing altogether or can't be parsed, fallback is returned, otherwise the value is parsed */
	private getBoolean(paramname: string, fallback: boolean|null = null, validate?: (value: boolean)=>boolean): boolean|null {
		const {[paramname]: prop} = this.params;
		if (typeof prop !== 'string') {
			return fallback;
		}

		// Present but no value (&prop) === null --> true
		// Present with value --> parse
		if (prop === null) {
			return true;
		} else if (['true', 'yes', 'on', 'enable', 'enabled'].includes(prop.toLowerCase())) {
			return true;
		} else if (['', 'false', 'no', 'off', 'disable', 'disabled'].includes(prop.toLowerCase())) {
			return false;
		} else {
			return fallback;
		}
	}
}

// Now we just need some way to convert our page state into blacklab state
// And then we can put that into the url and be done with it
// though we still need some way to make the current parameters reactive (meaning that we can update the url when something changes)

const b = getStoreBuilder<PageState>();
export const actions = {
	docs: {
		caseSensitive: b.commit((state, payload: boolean) => state.hitDisplaySettings.caseSentive = payload, 'docs_casesentisive'),
		groupBy: b.commit((state, payload: string[]) => state.hitDisplaySettings.groupBy = payload, 'docs_groupby'),
		sort: b.commit((state, payload: string) => state.hitDisplaySettings.sort = payload, 'docs_sort'),
		page: b.commit((state, payload: number) => state.hitDisplaySettings.page = payload, 'docs_page'),
		viewGroup: b.commit((state, payload: string) => state.hitDisplaySettings.viewGroup = payload, 'docs_viewgroup'),
	},
	filter: b.commit((state, payload: FilterField) => {state.filters = { ...state.filters, [payload.name]: payload};}, 'filter'),
	clearFilters: b.commit(state => state.filters = {}, 'clearfilters'),
	hits: {
		caseSensitive: b.commit((state, payload: boolean) => state.hitDisplaySettings.caseSentive = payload, 'hits_casesentisive'),
		groupBy: b.commit((state, payload: string[]) => state.hitDisplaySettings.groupBy = payload, 'hits_groupby'),
		sort: b.commit((state, payload: string) => state.hitDisplaySettings.sort = payload, 'hits_sort'),
		page: b.commit((state, payload: number) => state.hitDisplaySettings.page = payload, 'hits_page'),
		viewGroup: b.commit((state, payload: string) => state.hitDisplaySettings.viewGroup = payload, 'hits_viewgroup'),
	},
	operation: b.commit((state, payload: 'hits'|'docs') => state.operation = payload, 'operation'),
	pageSize: b.commit((state, payload: number) => state.pageSize = payload, 'pagesize'),
	pattern: b.commit((state, payload: PropertyField) => {state.pattern = {...state.pattern, [payload.name]: payload};}, 'pattern'),
	clearPattern: b.commit(state => state.pattern = {}, 'clearpattern'),
	// may require some further work based on how it's used in practise
	patternString: b.commit((state, payload: string) => state.patternString = payload, 'patternstring'),
	patternQuerybuilder: b.commit((state, payload: string) => state.patternQuerybuilder = payload, 'patternquerybuilder'),
	sampleMode: b.commit((state, payload: 'percentage'|'count') => state.sampleMode = payload, 'samplemode'),
	sampleSeed: b.commit((state, payload: number|null) => state.sampleSeed = payload, 'sampleseed'),
	sampleSize: b.commit((state, payload: number|null) => {
		if (payload == null) {
			state.sampleSize = payload;
			return;
		}

		if (state.sampleMode === 'percentage') {
			state.sampleSize = Math.max(0, Math.min(payload, 100));
		} else {
			state.sampleSize = Math.max(0, payload);
		}
	}, 'samplesize'),
	within: b.commit((state, payload: string|null) => state.within = payload?payload:null, 'within'),
	wordsAroundHit: b.commit((state, payload: number|null) => state.wordsAroundHit = payload, 'wordsaroundhit')
};

export const getState = b.state();
export const store = b.vuexStore({state: new UrlPageState().get()});
