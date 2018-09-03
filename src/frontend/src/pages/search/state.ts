import * as $ from 'jquery';
import * as BLTypes from '../../types/blacklabtypes';

import {getStoreBuilder} from 'vuex-typex';

import {FilterField, PropertyField} from '../../types/pagetypes';
import {makeRegexWildcard, makeWildcardRegex} from '../../utils';
import parseCql from '../../utils/cqlparser';
import parseLucene from '../../utils/lucene2filterparser';
import { debugLog } from '../../utils/debug';

const enum defaults {
	pageSize = 20,
	wordsAroundHit = 3,
	sampleMode = 'percentage'
}

type PageState = {
	filters: {[key: string]: FilterField};
	hitDisplaySettings: HitDisplaySettings;
	docDisplaySettings: DocDisplaySettings;
	/** More of a display mode on the results */
	operation: 'hits'|'docs';
	pageSize: number;
	pattern: {[key: string]: PropertyField};
	patternString: string;
	sampleMode: 'percentage'|'count';
	sampleSeed: string;
	sampleSize: number;
	within?: string;
	wordsAroundHit?: number;
};

interface SearchDisplaySettings {
	/** case-sentive grouping */
	caseSentive: boolean;
	groupBy: string[];
	sort?: string;
}

interface HitDisplaySettings extends SearchDisplaySettings {
	viewGroup?: string;
}
interface DocDisplaySettings extends SearchDisplaySettings { // tslint:disable-line
	// nothing yet
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

	constructor(uri: uri.URI = new URI()) {
		this.paths = uri.segmentCoded();
		this.params = uri.search(true);
	}

	get filters(): {[key: string]: FilterField} {
		const luceneString = this.getString('filter', undefined, v=>v?v:undefined);
		if (luceneString == null) {
			return {};
		}
		try {
			return parseLucene({filter: luceneString}).reduce((acc, v) => {acc[v.name] = v; return acc;}, {});
		} catch (error) {
			debugLog('Cannot decode lucene query ', luceneString);
			return {};
		}
	}

	get operation(): 'hits'|'docs'|undefined {
		const path = this.paths.length ? this.paths[this.paths.length-1].toLowerCase() : undefined;
		if (['hits', 'docs'].includes(path)) {
			return path as any;
		} else {
			return undefined;
		}
	}

	get page(): number {
		const page = this.getNumber('start', 0, v => Math.floor(Math.max(0, v)/this.pageSize)/* round down to nearest page containing the starting index */);
		return page;
	}

	get pageSize(): number {
		return this.getNumber('number', defaults.pageSize, v => [20,50,100,200].includes(v) ? v : defaults.pageSize);
	}

	get pattern(): {[key: string]: PropertyField} {
		function isCase(value) { return value.startsWith('(?-i)') || value.startsWith('(?c)'); }
		function stripCase(value) { return value.substr(value.startsWith('(?-i)') ? 5 : 4); }

		const pattString = this.getString('patt', undefined, v=>v?v:undefined);
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
					const expr = stack.shift();
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

	get patternString(): string {
		return this.getString('patt', '');
	}

	get sampleMode(): 'count'|'percentage' {
		// If 'sample' exists we're in count mode, otherwise if 'samplenum' (and is valid), we're in percent mode
		// ('sample' also has precendence for the purposes of determining samplesize)
		if (this.getNumber('sample') != null) {
			return 'count';
		} else if (this.getNumber('samplemode', undefined, v => (v >= 0 && v <=100) ? v : undefined) != null) {
			return 'percentage';
		} else {
			return defaults.sampleMode;
		}
	}

	get sampleSeed(): string|undefined {
		return this.getString('sampleseed', undefined, v => v?v:undefined);
	}

	get sampleSize(): number|undefined {
		// Use 'sample' unless missing, then use 'samplenum', if 0-100 (as it's percentage-based)
		return this.getNumber('sample', this.getNumber('samplenum', undefined, v => (v >= 0 && v <=100) ? v : undefined));
	}

	// TODO these might become dynamic in the future, then we need extra manual checking
	get within(): 'p'|'s'|undefined {
		return undefined; // TODO
	}

	get wordsAroundHit(): number {
		return this.getNumber('wordsaroundhit', defaults.wordsAroundHit, v => v >= 0 && v <= 10 ? v : defaults.wordsAroundHit);
	}

	get hitDisplaySettings(): HitDisplaySettings {
		if (this.operation !== 'hits') {
			// not the active view, use default/uninitialized settings
			return {
				caseSentive: false,
				groupBy: [],
				sort: undefined,
				viewGroup: undefined
			};
		} else {
			const groupBy = this.getString('group', '')
			.split(',')
			.map(g => g.trim());

			return {
				groupBy,
				caseSentive: groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', undefined, v => v?v:undefined),
				viewGroup: this.getString('viewgroup', undefined, v => (v && groupBy.length)?v:undefined)
			};
		}
	}

	get docDisplaySettings(): DocDisplaySettings {
		if(this.operation !== 'docs') {
			return {
				caseSentive: false,
				groupBy: [],
				sort: undefined
			};
		} else {
			const groupBy = this.getString('group', '')
			.split(',')
			.map(g => g.trim());

			return {
				groupBy,
				caseSentive: groupBy.every(g => g.endsWith(':s')),
				sort: this.getString('sort', undefined, v => v?v:undefined),
			};
		}
	}

	/**
	 * Get the parameter by the name of paramname from our query parameters.
	 * If the parameter is missing or is NaN, the fallback will be returned,
	 * otherwise, the parameter is passed to the validate function (if present), and the result is returned.
	 */
	private getNumber(paramname: string, fallback?: number|undefined, validate?: (value: number)=>number|undefined|null): number|undefined {
		const {[paramname]: prop} = this.params;
		if (typeof prop !== 'string') {
			return fallback;
		}
		const val = Number.parseInt(prop);
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
	private getString(paramname: string, fallback?: string|undefined, validate?: (value: string)=>string|undefined): string|undefined {
		const {[paramname]: prop} = this.params;
		if (typeof prop !== 'string') {
			return fallback;
		}
		return validate ? validate(prop) : prop;
	}
	/** If the property is missing altogether or can't be parsed, fallback is returned, otherwise the value is parsed */
	private getBoolean(paramname: string, fallback?: boolean|undefined, validate?: (value: boolean)=>boolean): boolean|undefined {
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

// let state: PageState = {
// 	...new UrlPageState() // initialize using current url.
// };
/*
type PageState = {
	filters: {[key: string]: FilterField};
	hitDisplaySettings: HitDisplaySettings;
	docDisplaySettings: DocDisplaySettings;
	operation: 'hits'|'docs';
	pageSize: number;
	pattern: {[key: string]: PropertyField};
	patternString: string;
	sampleMode: 'percentage'|'count';
	sampleSeed: string;
	sampleSize: number;
	within: string|'__default__';
	wordsAroundHit?: number;
};
*/

// interface SearchDisplaySettings {
// 	/** case-sentive grouping */
// 	caseSentive: boolean;
// 	groupBy: string[];
// 	sort?: string;
// }

// interface HitDisplaySettings extends SearchDisplaySettings {
// 	viewGroup?: string;
// }

const b = getStoreBuilder<PageState>();
export const actions = {
	filter: b.commit((state, payload: FilterField) => {state.filters = { ...state.filters, [payload.name]: payload};}, 'filter'),
	clearFilters: b.commit(state => state.filters = {}),
	pattern: b.commit((state, payload: PropertyField) => {state.pattern = {...state.pattern, [payload.name]: payload};}),
	clearPattern: b.commit(state => state.pattern = {}),
};

export const getState = b.state();
export const store = b.vuexStore();
