import URI from 'urijs';
import Vue from 'vue';
import Vuex from 'vuex';

import memoize from 'memoize-decorator';
import {getStoreBuilder} from 'vuex-typex';

import {FilterField, PropertyField} from '@/types/pagetypes';
import {makeRegexWildcard} from '@/utils';
import parseCql from '@/utils/cqlparser';
import parseLucene from '@/utils/lucene2filterparser';
import {debugLog} from '@/utils/debug';

import * as FormModule from '@/store/search/formModule';
import * as GlobalSettingsModule from '@/store/search/globalSettingsModule';
import * as ResultsSettingsModule from '@/store/search/resultsModule';
import cqlparser from '@/utils/cqlparser';

Vue.use(Vuex);

/** All unknown/unspecified properties must be initialized to null to enable state reactivity */
export type RootState = {
	form: FormModule.ModuleRootState;
	globalSettings: GlobalSettingsModule.ModuleRootState;
	resultSettings: ResultsSettingsModule.ModuleRootState;
};

/** Decode the current url into a valid page state configuration. Keep everything private except the getters */
export class UrlPageState implements RootState {
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
	get form(): FormModule.ModuleRootState {
		return {
			filters: this.filters,
			pattern: {
				simple: {
					annotationValues: this.pattern,
					within: this.within
				},
				queryBuilder: this.patternQuerybuilder,
				cql: this.patternString,
			},
			activePattern: this.activePattern,
			submittedParameters: null
		};
	}

	@memoize
	get globalSettings(): GlobalSettingsModule.ModuleRootState {
		return {
			operation: this.viewedResults,
			pageSize: this.pageSize,
			sampleMode: this.sampleMode,
			sampleSeed: this.sampleSeed,
			sampleSize: this.sampleSize,
			wordsAroundHit: this.wordsAroundHit
		};
	}

	@memoize
	get hitsSettings() {
		return this.getLocalSearchParameters('hits');
	}

	@memoize
	get docsSettings() {
		return this.getLocalSearchParameters('docs');
	}

	@memoize
	get resultSettings() {
		return {
			viewedResults: this.viewedResults, // TODO rename
			settings: {
				hits: this.getLocalSearchParameters('hits'),
				docs: this.getLocalSearchParameters('docs'),
			}
		};
	}

	public get(): RootState {
		return {
			form: this.form,
			globalSettings: this.globalSettings,
			resultSettings: this.resultSettings,
		};
	}

	@memoize
	get activePattern() {
		if (Object.keys(this.pattern).length > 0) {
			return 'simple';
		} else if (this.patternQuerybuilder) {
			return 'queryBuilder';
		} else if (this.patternString) {
			return 'cql';
		} else {
			return 'simple';
		}
	}

	@memoize
	get filters(): {[key: string]: FilterField} {
		const luceneString = this.getString('filter', null, v=>v?v:null);
		if (luceneString == null) {
			return {};
		}
		try {
			return parseLucene(luceneString).reduce((acc, v) => {acc[v.id] = v; return acc;}, {});
		} catch (error) {
			debugLog('Cannot decode lucene query ', luceneString, error);
			return {};
		}
	}

	@memoize
	get viewedResults(): 'hits'|'docs'|null {
		const path = this.paths.length ? this.paths[this.paths.length-1].toLowerCase() : null;
		if (path !== 'hits' && path !== 'docs') {
			return null;
		} else {
			return path;
		}
	}

	@memoize
	get pageSize(): number {
		return this.getNumber('number', GlobalSettingsModule.defaults.pageSize, v => [20,50,100,200].includes(v) ? v : GlobalSettingsModule.defaults.pageSize)!;
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
			return Object.entries(attributeValues).map(([id, values]) => {
				const caseSensitive = values.every(isCase);
				if (caseSensitive) {
					values = values.map(stripCase);
				}
				return {
					id,
					case: caseSensitive,
					value: makeRegexWildcard(values.join(' '))
				} as PropertyField;
			})
			.reduce((acc, v) => {acc[v.id] = v; return acc;}, {});
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
			return GlobalSettingsModule.defaults.sampleMode;
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

	// No memoize - has parameters
	public getLocalSearchParameters(view: string): ResultsSettingsModule.ModuleRootState['settings']['docs'] {
		if(this.viewedResults !== view) {
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
				groupBy: groupBy.map(g => g.replace(/\:[is]$/, '')), // strip case-sensitivity flag from value, is only visible in url
				caseSensitive: groupBy.length > 0 && groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', null, v => v?v:null),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:null),
				page: this.getNumber('first', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */)!,
			};
		}
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

const b = getStoreBuilder<RootState>();

// NOTE: these keys should match with the keys of the respective ModuleRootStates in RootState
const form = FormModule.create(b, 'form');
const global = GlobalSettingsModule.create(b, 'globalSettings');
const results = ResultsSettingsModule.create(b, 'resultSettings');

export const modules = {
	form,
	global,
	results
};

const initialState: RootState = new UrlPageState().get();

export const actions = {
	search: b.commit(state => {
		// TODO make this implicit instead of having to write->read->write state here
		modules.form.actions.search();
		const cqlPatt = state.form.submittedParameters!.pattern;
		if (state.resultSettings.viewedResults == null) {
			state.resultSettings.viewedResults = cqlPatt ? 'hits' : 'docs';
		}
	}),

	reset: b.commit(state => {
		modules.form.actions.reset();
		modules.global.actions.reset();
		modules.results.actions.reset();
	}, 'reset'),

	replace: b.dispatch(({rootState: state}, payload: RootState) => {
		modules.form.actions.replace(payload.form);
		modules.global.actions.replace(payload.globalSettings);
		modules.results.actions.replace(payload.resultSettings);

		// TODO determine if we need to initiate a search here?
		// TODO replace action? resultview

		debugLog('Finished replacing/initializing state');
	}, 'replace'),
};

export const getState = b.state();
export const store = b.vuexStore();
actions.replace(initialState);

// TODO remove me, debugging only - use expose-loader or something?
(window as any).actions = actions;
