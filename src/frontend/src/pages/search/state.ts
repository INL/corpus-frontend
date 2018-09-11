import URI from 'urijs';
import Vue from 'vue';
import Vuex from 'vuex';

import {getStoreBuilder} from 'vuex-typex';

import memoize from 'memoize-decorator';

import {FilterField, PropertyField} from '../../types/pagetypes';
import {makeRegexWildcard, makeWildcardRegex} from '../../utils';
import parseCql from '../../utils/cqlparser';
import parseLucene from '../../utils/lucene2filterparser';
import { debugLog } from '../../utils/debug';

Vue.use(Vuex);

const enum defaults {
	pageSize = 20,
	sampleMode = 'percentage'
}

export interface SearchDisplaySettings {
	/** case-sensitive grouping */
	caseSensitive: boolean;
	groupBy: string[];
	sort: string|null;
	page: number;
	viewGroup: string|null;
}

/** All unknown/unspecified properties must be initialized to null to enable state reactivity */
export type PageState = {
	activePattern: 'pattern'|'patternString'|'patternQueryBuilder';
	docDisplaySettings: SearchDisplaySettings;
	filters: {[key: string]: FilterField};
	hitDisplaySettings: SearchDisplaySettings;
	/** More of a display mode on the results */
	operation: 'hits'|'docs'|null;
	pageSize: number;
	pattern: {[key: string]: PropertyField};
	patternString: string|null;
	patternQuerybuilder: string|null;
	sampleMode: 'percentage'|'count';
	sampleSeed: number|null;
	sampleSize: number|null;
	within: string|null;
	wordsAroundHit: number|null;
};

/** Decode the current url into a valid page state configuration. Keep everything private except the getters */
export class UrlPageState implements PageState {
	/**
	 * Path segments of the url this was constructed with, typically something like ['corpus-frontend', corpusname, 'search', ('docs'|'hits')?]
	 * But might contain extra leading segments if the application is proxied.
	 */
	private paths: string[];
	/** Query parameters parsed into an object, repeated fields are turned into an array, though all values are kept as-is as strings */
	private params: {[key: string]: string|string[]|null};

	constructor(uri = new URI()) {
		this.paths = uri.segmentCoded();
		this.params = uri.search(true);
	}

	@memoize
	get activePattern() {
		if (Object.keys(this.pattern).length > 0) {
			return 'pattern';
		} else if (this.patternQuerybuilder) {
			return 'patternQueryBuilder';
		} else if (this.patternString) {
			return 'patternString';
		} else {
			return 'pattern';
		}
	}

	@memoize
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

	@memoize
	get operation(): 'hits'|'docs'|null {
		const path = this.paths.length ? this.paths[this.paths.length-1].toLowerCase() : null;
		if (path !== 'hits' && path !== 'docs') {
			return null;
		} else {
			return path;
		}
	}

	@memoize
	get pageSize(): number {
		return this.getNumber('number', defaults.pageSize, v => [20,50,100,200].includes(v) ? v : defaults.pageSize)!;
	}

	@memoize
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

	@memoize
	get patternString(): string|null {
		return this.getString('patt', null, v => v?v:null);
	}

	// TODO verify querybuilder can parse
	@memoize
	get patternQuerybuilder(): string|null {
		return this.patternString;
	}

	@memoize
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

	@memoize
	get sampleSeed(): number|null {
		return this.getNumber('sampleseed', null);
	}

	@memoize
	get sampleSize(): number|null {
		// Use 'sample' unless missing, then use 'samplenum', if 0-100 (as it's percentage-based)
		return this.getNumber('sample', this.getNumber('samplenum', null, v => (v >= 0 && v <=100) ? v : null));
	}

	// TODO these might become dynamic in the future, then we need extra manual checking
	@memoize
	get within(): 'p'|'s'|null {
		return null; // TODO
	}

	@memoize
	get wordsAroundHit(): number|null {
		return this.getNumber('wordsaroundhit', null, v => v != null && v >= 0 && v <= 10 ? v : null);
	}

	@memoize
	get hitDisplaySettings(): SearchDisplaySettings {
		if (this.operation !== 'hits') {
			// not the active view, use default/uninitialized settings
			return {
				caseSensitive: false,
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
				caseSensitive: groupBy.length > 0 && groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', null, v => v?v:null),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:null),
				page: this.getNumber('first', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */)!,
			};
		}
	}

	@memoize
	get docDisplaySettings(): SearchDisplaySettings {
		if(this.operation !== 'docs') {
			return {
				caseSensitive: false,
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
				caseSensitive: groupBy.length > 0 && groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', null, v => v?v:null),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:null),
				page: this.getNumber('first', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */)!,
			};
		}
	}

	@memoize
	public get(): PageState {
		return {
			activePattern: this.activePattern,
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

// A type that only has those fields of T with type M
// Don't even ask
type FancyProperties<T, M> = Pick<T, {
	[K in keyof T]: T[K] extends M ? K : never
}[keyof T]>;

// Now we just need some way to convert our page state into blacklab state
// And then we can put that into the url and be done with it
// though we still need some way to make the current parameters reactive (meaning that we can update the url when something changes)
const initialState: PageState = new UrlPageState().get();
const b = getStoreBuilder<PageState>();

const [hitActions, docActions] = (['docDisplaySettings', 'hitDisplaySettings'] as Array<keyof FancyProperties<PageState, SearchDisplaySettings>>).map(namespace => {
	const ctx = b.module<SearchDisplaySettings>(namespace, initialState[namespace]);

	return {
		caseSensitive: ctx.commit((state, payload: boolean) => state.caseSensitive = payload, 'casesensitive'),
		groupBy: ctx.commit((state, payload: string[]) => {
			state.groupBy = payload;
			state.viewGroup = null;
			state.sort = null;
			state.page = 0;
		} , 'groupby'),
		sort: ctx.commit((state, payload: string|null) => state.sort = payload, 'sort'),
		page: ctx.commit((state, payload: number) => state.page = payload, 'page'),
		viewGroup: ctx.commit((state, payload: string|null) => {
			state.viewGroup = payload;
			state.sort = null;
			state.page = 0;
		},'viewgroup'),

		reset: ctx.commit(state => {
			state.caseSensitive = false;
			state.groupBy = [];
			state.page = 0;
			state.sort = null;
			state.viewGroup = null;
		}, 'reset'),

		replace: ctx.commit((state, payload: SearchDisplaySettings) => {
			Object.assign(state, payload);
		}, 'replace'),
	};
});

export const actions = {
	docs: docActions,
	initFilter: b.commit((state, payload: FilterField) => Vue.set(state.filters, payload.name, payload), 'initfilter'),
	filter: b.commit((state, {id, values}: {id: string, values: string[]}) => state.filters[id].values = values, 'filter'),
	clearFilters: b.commit(state => Object.entries(state.filters).forEach(([id, filter]) => filter.values = []), 'clearfilters'),
	hits: hitActions,
	operation: b.commit((state, payload: 'hits'|'docs'|null) => {
		if (['hits', 'docs'].includes(payload!)) { state.operation = payload; }
	}, 'operation'),
	pageSize: b.commit((state, payload: number) => {
		if ([20, 50, 100, 200].includes(payload)) { state.pageSize = payload;}
	}, 'pagesize'),

	initProperty: b.commit((state, payload: PropertyField) => Vue.set(state.pattern, payload.name, payload), 'initproperty'),
	property: b.commit((state, {id, payload}: {id: string, payload: Partial<PropertyField>}) => state.pattern[id]! = {...state.pattern[id]!, ...payload}, 'property'),
	clearProperties: b.commit(state => Object.entries(state.pattern).forEach(([id, prop]) => {prop!.value = ''; prop!.case = false;}), 'clearproperties'),

	// may require some further work based on how it's used in practise
	patternString: b.commit((state, payload: string) => state.patternString = payload, 'patternstring'),
	patternQuerybuilder: b.commit((state, payload: string) => state.patternQuerybuilder = payload, 'patternquerybuilder'),
	sampleMode: b.commit((state, payload: 'percentage'|'count'|undefined|null) => {
		if (payload == null) { payload = defaults.sampleMode; } // reset on null, ignore on invalid string
		if (['percentage', 'count'].includes(payload)) { state.sampleMode = payload; }
	}, 'samplemode'),
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
	wordsAroundHit: b.commit((state, payload: number|null) => state.wordsAroundHit = payload, 'wordsaroundhit'),

	reset: b.commit(state => {
		docActions.reset();
		hitActions.reset();
		actions.clearFilters();
		actions.clearProperties();
		state.operation = null;
		state.pageSize = defaults.pageSize as number;
		state.patternQuerybuilder = null;
		state.patternString = null;
		state.sampleMode = defaults.sampleMode;
		state.sampleSeed = null;
		state.sampleSize = null;
		state.within = null;
		state.wordsAroundHit = null;
	}, 'reset'),

	replace: b.commit((state, payload: PageState) => {
		// this is a little nasty but maybe it will work, extract all special fields
		// reset the rest by batch assignment, then place back and treat the specials

		const specialFields = {
			pattern: state.pattern,
			docDisplaySettings: state.docDisplaySettings,
			hitDisplaySettings: state.hitDisplaySettings,
			filters: state.filters,
		};

		// Reset all basic properties, place back the fields with nested properties
		// (we can't replace those without losing reactivity)
		Object.assign(state, payload, specialFields);

		// Now manually replace the values in those special fields
		actions.clearFilters();
		actions.clearProperties();
		Object.values(payload.filters).forEach(f => actions.filter({id: f.name, values: f.values}));
		Object.values(payload.pattern).forEach(p => actions.property({id: p.name, payload: p}));
		actions.docs.replace(payload.docDisplaySettings);
		actions.hits.replace(payload.hitDisplaySettings);
	}, 'replace')
};

export const get = {
	/** If no PropertyField is active, the array is collapsed to null */
	activePatternValue: b.read((state): PropertyField[]|string|null => {
		if (state.activePattern === 'pattern') {
			return get.activeProperties();
		} else {
			return state[state.activePattern];
		}
	}, 'getActivePatternValue'),
	/** If no property is active, the array collapses to null */
	activeProperties: b.read(state => {
		const active = Object.values(state.pattern).filter(p => !!p.value);
		return active.length ? active : null;
	}, 'getproperties'),
	/** If no filter is active, the array collapses to null */
	activeFilters: b.read(state => {
		const active = Object.values(state.filters).filter(f => f.values.length > 0);
		return active.length ? active : null;
	}, 'getfilters'),

	displaySettings: b.read(state => {
		switch (state.operation) {
			case 'docs': return state.docDisplaySettings;
			case 'hits': return state.hitDisplaySettings;
			default: return null;
		}
	}, 'getDisplaySettings'),
};

export const getState = b.state();
export const store = b.vuexStore({state: initialState});

// TODO remove me, debugging only - use expose-loader or something?
(window as any).actions = actions;
