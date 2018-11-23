import stableStringify from 'json-stable-stringify';
import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import {RootState, SlimRootState} from '@/store';
import {HistoryEntry} from '@/store/history';
import {SubmittedParameters} from '@/store/form';

export function makeWildcardRegex(original: string) {
	return original
		.replace(/([\^$\-\\.(){}[\]+])/g, '\\$1') // add slashes for regex characters
		.replace(/\*/g, '.*') // * -> .*
		.replace(/\?/g, '.'); // ? -> .
}

export function makeRegexWildcard(original: string) {
	return original
	.replace(/\\([\^$\-\\(){}[\]+])/g, '$1') // remove most slashes
	.replace(/\\\./g, '_ESC_PERIOD_') // escape \.
	.replace(/\.\*/g, '*') // restore *
	.replace(/\./g, '?') // restore ?
	.replace(/_ESC_PERIOD_/g, '.'); // unescape \. to .
}

export function NaNToNull(n: number) { return isNaN(n) ? null : n; }

/**
 * @param hit - the hit
 * @param prop - property of the context to retrieve, defaults to PROPS.firstMainProp (usually 'word')
 * @returns string[3] where [0] == before, [1] == hit and [2] == after, values are strings created by
 * concatenating and alternating the punctuation and values itself
 */
export function snippetParts(hit: BLTypes.BLHitSnippet, prop: string): [string, string, string] {
	const punctAfterLeft = hit.match.word.length > 0 ? hit.match.punct[0] : '';
	const before = words(hit.left, prop, false, punctAfterLeft);
	const match = words(hit.match, prop, false, '');
	const after = words(hit.right, prop, true, '');
	return [before, match, after];
}

/**
 * @param context
 * @param prop - property to retrieve
 * @param doPunctBefore - add the leading punctuation?
 * @param addPunctAfter - trailing punctuation to append
 * @returns concatenated values of the property, interleaved with punctuation from context['punt']
 */
export function words(context: BLTypes.BLHitSnippetPart, prop: string, doPunctBefore: boolean, addPunctAfter: string): string {
	const parts = [] as string[];
	const n = context[prop] ? context[prop].length : 0;
	for (let i = 0; i < n; i++) {
		if ((i === 0 && doPunctBefore) || i > 0) {
			parts.push(context.punct[i]);
		}
		parts.push(context[prop][i]);
	}
	parts.push(addPunctAfter);
	return parts.join('');
}

/**
 * Converts form state into a cql token string.
 * If pattern is a string already, it is returned as-is.
 * Empty patterns are returned as undefined.
 *
 * Every AnnotationValue is split on whitespace, and every word is mapped to a token with the same position.
 * I.E. lemma="multiple words" is converted to [lemma="multiple"][lemma="words"]
 * Values are converted from wildcard to regex, and case sensitivity flags are inserted where case-sensitive searching is specified.
 */
export function getPatternString(pattern: SubmittedParameters['pattern']): string|undefined {
	if (!pattern) {
		return undefined;
	}
	if (typeof pattern === 'string') {
		return pattern.trim() || undefined; // coerce empty to undef
	}

	// First split the properties into individual words and pair them
	const tokens = [] as Array<{[key: string]: string}>;
	pattern.annotations.forEach(field => {
		field.value.trim().split(/\s+/).filter(v => !!v).forEach((word, i) => {
			if (!tokens[i]) {
				tokens[i] = {};
			}

			tokens[i][field.id] = (field.case ? '(?-i)' : '') + makeWildcardRegex(word);
		});
	});

	const tokenStrings = [] as string[];
	tokens.forEach(token => {
		// push all attributes in this token
		const attributesStrings = [] as string[];
		Object.entries(token).forEach(([key, value]) => {
			if (value) { // don't push empty attributes
				attributesStrings.push(key + '=' + '"' + value + '"');
			}
		});

		tokenStrings.push('[', attributesStrings.join(' & '), ']');
	});

	if (tokenStrings.length > 0 && pattern.within) {
		tokenStrings.push(' within ', '<'+ pattern.within+'/>');
	}

	return tokenStrings.join('') || undefined;
}

/**
 * Converts the active filters into a parameter string blacklab-server can understand.
 *
 * Values from filters with types other than 'range' or 'select' will be split on whitespace and individual words will be surrounded by quotes.
 * Effectively transforming
 * "quoted value" not quoted value
 * into
 * "quoted value" "not" "quoted" "value"
 *
 * The result of this is that the filter will respond to any value within one set of quotes, so practially an OR on individual words.
 *
 * If the array is empty or null, undefined is returned,
 * so it can be placed directly in the request paremeters without populating the object if the value is not present.
 */
export function getFilterString(filters: AppTypes.MetadataValue[]): string|undefined {
	if (!filters.length) {
		return undefined;
	}

	const filterStrings = [] as string[];
	for (const filter of filters) {
		if (!filter.values.length) {
			continue;
		}

		if (filterStrings.length) {
			filterStrings.push(' AND ');
		}

		if (filter.type === 'range') {
			filterStrings.push(filter.id, ':', '[', filter.values[0], ' TO ', filter.values[1], ']');
		} else if (filter.type !== 'text') {
			// Surround each individual value with quotes, and surround the total with brackets
			filterStrings.push(filter.id, ':', '("', filter.values.join('" "'), '")');
		} else {
			// Do the quoting thing
			const resultParts = [] as string[];

			filter.values.forEach(value => {
				const quotedParts = value.split(/"/);
				let inQuotes = false;
				for (let part of quotedParts) {
					if (inQuotes) {
						// Inside quotes. Add literally.
						resultParts.push(' "');
						resultParts.push(part);
						resultParts.push('"');
					} else {
						// Outside quotes. Surround each word with quotes.
						part = part.trim();
						if (part.length > 0) {
							resultParts.push(' "');
							resultParts.push(part.split(/\s+/).join('" "'));
							resultParts.push('" ');
						}
					}
					inQuotes = !inQuotes;
				}
			});

			filterStrings.push(filter.id, ':', '(' + resultParts.join('').trim(), ')');
		}
	}

	return filterStrings.join('') || undefined;
}

/** Converts page state into a query for blacklab-server. */
export function getBLSearchParametersFromState(state: RootState): BLTypes.BLSearchParameters {
	if (state.viewedResults == null) {
		throw new Error('Cannot generate blacklab parameters without knowing what kinds of results are being viewed (hits or docs)');
	}

	const submittedParameters = state.form.submittedParameters;
	if (submittedParameters == null) {
		throw new Error('Cannot generate blacklab parameters before search form has been submitted');
	}

	if (state.settings.sampleSize && state.settings.sampleSeed == null) {
		throw new Error('Should provide a sampleSeed when random sampling, or every new pagination action will use a different seed');
	}

	const viewProps = state.results[state.viewedResults];
	return {
		filter: getFilterString(submittedParameters.filters),
		first: state.settings.pageSize * viewProps.page,
		group: viewProps.groupBy.map(g => g + (viewProps.caseSensitive ? ':s':':i')).concat(viewProps.groupByAdvanced).join(',') || undefined,
		// group: viewProps.groupBy.join(',') || undefined,
		number: state.settings.pageSize,
		patt: getPatternString(submittedParameters.pattern),

		sample: (state.settings.sampleMode === 'percentage' && state.settings.sampleSize) ? state.settings.sampleSize : undefined,
		samplenum: (state.settings.sampleMode === 'count' && state.settings.sampleSize) ? state.settings.sampleSize : undefined,
		sampleseed: state.settings.sampleSize != null ? state.settings.sampleSeed! /* non-null precondition checked above */ : undefined,

		sort: viewProps.sort != null ? viewProps.sort : undefined,
		viewgroup: viewProps.viewGroup != null ? viewProps.viewGroup : undefined,
		wordsaroundhit: state.settings.wordsAroundHit != null ? state.settings.wordsAroundHit : undefined,
	};
}

export function getHistoryEntryFromState(state: SlimRootState): HistoryEntry {
	// tslint:disable
	function hashJavaDJB2(str: string) {
		let hash = 0;
		let i = 0;
		let char: number;
		const l = str.length;
		while (i < l) {
			char  = str.charCodeAt(i);
			hash  = ((hash<<5)-hash)+char;
			hash |= 0; // Convert to 32bit integer
			++i
		}
		return hash;
	};
	// tslint:enable

	// It's important we sort arrays and values consisiting of multiple items
	// So we can calculate a stable hash.

	// blech, if we don't do this, and we sort the annotations, that counts as a state change
	// (everything is still reactive)
	// this causes components to rerender where they shouldn't and makes results go missing.
	state = JSON.parse(JSON.stringify(Object.assign({}, state, {history: undefined, corpus: undefined})));

	const pattern = state.form.submittedParameters!.pattern;
	if (pattern && typeof pattern !== 'string') {
		pattern.annotations.sort((l, r) => l.id.localeCompare(r.id));
	}

	const base = {
		filters: Object.values(state.form.filters).filter(v => v.values.length).sort((l, r) => l.id.localeCompare(r.id)),
		groupBy: state.results[state.viewedResults!].groupBy.sort((l, r) => l.localeCompare(r)),
		groupByAdvanced: state.results[state.viewedResults!].groupByAdvanced.sort((a, b) => a.localeCompare(b)),
		pattern,
		caseSensitiveGroupBy: state.results[state.viewedResults!].caseSensitive,
		viewedResults: state.viewedResults!,
	};

	return {
		version: 1,
		...base,

		displayValues: {
			filters: base.filters.map(f => `${f.id}="${f.values.toString()}`).join(' ') || '-',
			pattern: pattern ? getPatternString(pattern) || '-' : '-'
		},
		hash: hashJavaDJB2(stableStringify(Object.assign({}, base, {viewedResults: undefined}))) // ignore the viewedResults for equality checks
	};
}

export function getBLSearchParametersFromHistory(entry: HistoryEntry): BLTypes.BLSearchParameters {
	return {
		filter: getFilterString(entry.filters),
		patt: getPatternString(entry.pattern),
		group: entry.groupBy.map(g => g + (entry.caseSensitiveGroupBy ? ':s':':i')).join(',') || undefined,
		number: 20,
		first: 0
	};
}

/**
 * Encodes search parameters into a page url as understood by fromPageUrl().
 * N.B. we assume we're mounted under /<contextRoot>/<corpus>/search/[hits|docs][/]?query=...
 * The contextRoot can be anything, even multiple segments (due to reverse proxy, different WAR deploy path, etc)
 * But we assume the /search/ part still exists.
 *
 * Removes any empty strings, arrays, null, undefineds prior to conversion, to shorten the resulting query string.
 */
export function getUrlFromParameters(operation: string, blsParams?: BLTypes.BLSearchParameters|null): string {
	const uri = new URI();
	const paths = uri.segmentCoded();
	const basePath = paths.slice(0, paths.lastIndexOf('search')+1);
	// basePath now contains our url path, up to and including /search/

	// If we're not searching, return a bare url pointing to /search/
	if (blsParams == null) {
		return uri.directory(basePath.join('')).search('').toString();
	}

	// remove null, undefined, empty strings and empty arrays from our query params
	const modifiedParams: Partial<BLTypes.BLSearchParameters> = {};
	Object.entries(blsParams).forEach(([key, value]: [keyof BLTypes.BLSearchParameters, BLTypes.BLSearchParameters[keyof BLTypes.BLSearchParameters]]) => {
		if (value == null) {
			return true;
		}
		if ((value as any).length === 0) { // remove empty strings/arrays
			return true;
		}
		modifiedParams[key] = value;
	});

	// Append the operation, query params, etc, and return.
	return uri.segmentCoded(basePath).segmentCoded(operation).search(modifiedParams).toString();
}

export function getUrlFromHistoryEntry(entry: HistoryEntry) {
	return getUrlFromParameters(entry.viewedResults, getBLSearchParametersFromHistory(entry));
}

// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
// Have a configurable url in the backend that's made available on the client that we can use here.
export function getDocumentUrl(pid: string, cql?: string) {
	let docUrl;
	switch (new URI().filename()) {
	case '':
		docUrl = new URI('../../docs/');
		break;
	case 'docs':
	case 'hits':
		docUrl = new URI('../docs/');
		break;
	case 'search':
	default: // some weird proxy?
		docUrl = new URI('./docs/');
		break;
	}

	return docUrl
		.absoluteTo(new URI().toString())
		.filename(pid)
		.search({
			// parameter 'query' controls the hits that are highlighted in the document when it's opened
			query: cql
		})
		.toString();
}

export function getSetPairsFromKeys<T extends {}>(keys: Array<keyof T>) {
	interface Self {
		value: T;
		$emit(eventName: string, payload: any): void;
	}

	type GetSetPair<P extends keyof T> = {
		get(this: Self): T[P];
		set(this: Self, value: T[P]): void;
	};

	const ret = {} as {
		[P in keyof T]: GetSetPair<P>;
	};

	keys.forEach(key => {
		ret[key] = {
			get() { return this.value[key]; },
			set(value) { this.$emit('input', Object.assign(this.value, {[key]: value})); }
		};
	});

	return ret;
}
