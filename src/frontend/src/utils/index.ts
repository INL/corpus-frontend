// TODO split this file into patternUtils, groupUtils and generic utils.


import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import * as UIModule from '@/store/search/ui';

export function escapeRegex(original: string, wildcardSupport: boolean) {
	original = original.replace(/([\^$\-\\.(){}[\]+])/g, '\\$1'); // add slashes for regex characters

	if (wildcardSupport) {
		return original
			.replace(/\*/g, '.*') // * -> .*
			.replace(/\?/g, '.'); // ? -> .
	} else {
		return original
			.replace(/([\*\?])/g, '\\$1');
	}
}

export function unescapeRegex(original: string, wildcardSupport: boolean) {
	original = original.replace(/\\([\^$\-\\(){}[\]+])/g, '$1'); // remove most slashes

	if (wildcardSupport) {
		return original
		.replace(/\\\./g, '_ESC_PERIOD_') // escape \.
		.replace(/\.\*/g, '*') // restore *
		.replace(/\./g, '?') // restore ?
		.replace(/_ESC_PERIOD_/g, '.'); // unescape \. to .
	} else {
		return original
		.replace(/\\([\.\?\*])/g, '$1'); // restore . ? *
	}
}

/**
 * Escapes the lucene term. This is done by surrounding it by quotes, unless wildcards (* and ?) should be preserved,
 * in which case characters are escaped on an individual basis.
 * Preserving wildcards is only possible when the string does not contain whitespace, as that is the term delimited and cannot be escaped
 * except by surrounding the term with quotes, which implicitly escapes wildcards.
 *
 * The resultant string should NOT need to be be surrounded by quotes again.
 */
export function escapeLucene(original: string, preserveWildcards: boolean) {
	if (!preserveWildcards || original.match(/\s+/)) {
		return `"${original.replace(/(")/g, '\\$1')}"`;
	}
	return original.replace(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|]|\^|"|~|:|\\|\/)/g, '\\$1');
}

/** Unescapes every lucene special character including double quotes, except wildcards */
export function unescapeLucene(original: string) {
	if (original.startsWith('"') && original.endsWith('"') && !original.endsWith('\\"')) {
		return original.substr(1, original.length - 2).replace(/\\(")/g, '$1');
	}

	return original.replace(/\\(\+|-|&&|\|\||!|\(|\)|{|}|\[|]|\^|"|~|:|\\|\/|\*|\?)/g, '$1');
}

export function NaNToNull(n: number) { return isNaN(n) ? null : n; }




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
 * Decode a value as passed to BlackLab back into a value for the UI.
 * @param value the value to be parsed
 * @param type the type that the value should be parsed to, see uiType in the annotation object. Different annotation search widgets have different escaping properties (i.e. can they contain multiple values, or just one, etc.)
 */
export const decodeAnnotationValue = (value: string|string[], type: Required<AppTypes.AnnotationValue>['type']): {case: boolean; value: string} => {
	function isCase(v: string) { return v.startsWith('(?-i)') || v.startsWith('(?c)'); }
	function stripCase(v: string) { return v.substr(v.startsWith('(?-i)') ? 5 : 4); }
	switch (type) {
		case 'text':
		case 'lexicon':
		case 'combobox': {
			let caseSensitive = false;
			const annotationValue = [value].flat().map(v => {
				if (isCase(v)) {
					v = stripCase(v);
					caseSensitive = true;
				}
				v = unescapeRegex(v, true).replace(/\\"/g, '"');
				// Only surround with quotes when we're joining multiple values into one string and this sub-value contains whitespace
				return Array.isArray(value) && v.match(/\s+/) ? `"${v}"` : v;
			}).join(' ');

			return {
				case: caseSensitive,
				value: annotationValue
			};
		}
		case 'select': {
			value = Array.isArray(value) ? value[0] : value;
			const caseSensitive = isCase(value);
			value = caseSensitive ? stripCase(value) : value;
			value = unescapeRegex(value, false).replace(/\\"/g, '"');
			return {
				case: caseSensitive,
				value
			};
		}
		case 'pos': // pos is handled separately (url-state-parser)
		default: throw new Error('Unimplemented uitype query decoder');
	}
};

/** Turn an annotation object into a "pattern" (cql) string ready for BlackLab. */
export const getAnnotationPatternString = (annotation: AppTypes.AnnotationValue): string[] => {
	const {id, case: caseSensitive, value, type} = annotation;

	if (!value.trim()) {
		return [''];
	}

	switch (type) {
		case 'pos':
			// already valid cql, no escaping or wildcard substitution.
			return [value];
		case 'select':
			return [`${id}="${escapeRegex(value.trim(), false).replace(/"/g, '\\"')}"`];
		case 'text':
		case 'lexicon':
		case 'combobox': {
			// if multiple tokens, split on quotes (removing them), and whitespace outside quotes, and then transform the values individually
			let resultParts = splitIntoTerms(value, true).map(v => escapeRegex(v.value, true));
			if (caseSensitive) {
				resultParts = resultParts.map(v => `(?-i)${v}`);
			}

			return resultParts.map(word => `${id}="${word}"`);
		}
		default: throw new Error('Unimplemented cql serialization for annotation type ' + type);
	}
};

type SplitString = {
	start: number;
	end: number;
	value: string;
	isQuoted: boolean;
};

/**
 * Split a search pattern string into its terms.
 * For example strings input in the "Simple Search" input.
 * This works by splitting the string on all whitespace (ignoring it), except where (a part of) the string is enclosed in double quotes (""), between which whitespace is preserved.
 * Double quotes and whitespace that has been used as separator is stripped from the value field of the returned structs.
 * Stripped quotes (not whitespace!) are however still reflected in the start and end properties. (meaning for a string that isQuoted, (end-start) === (value.length + 2))
 * This is because this function is also used to split out (and replace) the currently selected word/sequence of words for autocompleted annotations.
 * Note: quote escaping is not taken into consideration. Backslashes are treated as any other character
 * Examples:
 * "split word" behind another few --> ["split word", "behind", "another", "few"]
 * "wild* in split words" and such --> ["wild.* in split words", "and", "such"]
 * @param v the input string.
 * @param useQuoteDelimiters whether to use double quotes (") as delimiters or not. If not, the quotes are treated as regular characters.
 */
export const splitIntoTerms = (value: string, useQuoteDelimiters: boolean): SplitString[]  => {
	let i = 0;
	let inQuotes = false;
	let seg = '';
	let start = 0;
	let segs: Array<{start: number, end: number, value: string, isQuoted: boolean}> = [];
	for (const c of value) {
		switch (c) {
			case '"':
				if (useQuoteDelimiters) {
					// start or end of section (possibly both?)
					if (seg) {
						segs.push({start, end: i+1, value: seg, isQuoted: inQuotes})
						seg = '';
					}
					inQuotes = !inQuotes;
					start = i;
				} else {
					seg += c;
				}
				break;
			case ' ':
			case '\t':
			case '\r':
			case '\n':
			case '\f':
			case '\v':
				if (inQuotes) seg += c;
				else if (seg) {
					// this character is already no longer a part of the segment - hence no +1 on end
					segs.push({start, end: i, value: seg, isQuoted: inQuotes});
					seg = '';
				}
				break;
				// ignorable whitespace
			default:
				if (!seg && !inQuotes) start = i;
				seg += c;
				break;
		}
		++i;
	}
	if (seg) {
		segs.push({start, end: i+1, value: seg, isQuoted: inQuotes});
		seg = '';
	}
	return segs;
};

[{
	value: '"the simplest"',
	expect: [{
		start: 0,
		end: 14,
		value: 'the simplest',
		isQuoted: true
	}]
}, {
	value: 'this is " a test """ ',
	expect: [{
		start: 0,
		end: 4,
		value: 'this'
	}, {
		start: 5,
		end: 7,
		value: 'is'
	}, {
		start: 8,
		end: 18,
		value: ' a test ',
		isQuoted: true
	}]
}, {
	value: 'regular string',
	expect: [{
		start: 0,
		end: 7,
		value: 'regular'
	}, {
		start: 8,
		end: 14,
		value: 'string'
	}]
}, {
	value: '  starting with a few \t spaces \r\nhelp',
	expect: [{
		start: 2,
		end: 10,
		value: 'starting'
	}, {
		start: 11,
		end: 15,
		value: 'with'
	}, {
		start: 16,
		end: 17,
		value: 'a'
	}, {
		start: 18,
		end: 21,
		value: 'few'
	}, {
		start: 24,
		end: 30,
		value: 'spaces'
	}, {
		start: 33,
		end: 37,
		value: 'help'
	}]
},{
	value: '"normal everyday" string "with some quotes"',
	expect: [{
		start: 0,
		end: 17,
		value: 'normal everyday',
		isQuoted: true
	}, {
		start: 19,
		end: 24,
		value: 'string'
	}, {
		start: 26,
		end: 44,
		value: 'with some quotes',
		isQuoted: true
	}]
}].forEach(({value: fullValue, expect}) => {
	const split = splitIntoTerms(fullValue, true);
	split.forEach((part, index) => {
		const {start, end, value, isQuoted} = expect[index];
		const expand = part.isQuoted ? 1 : 0;
		if (fullValue.substring(part.start + expand, part.end - expand) !== value) {
			console.log('part: ', part, 'expect: ', expect[index]);
		}
	})
});

/** Parenthesize part of a BCQL query if it's not already */
function parenQueryPart(query: string, exceptions: string[] = []) {
	query = query.trim();
	if (query.match(/^\(.+\)$/) || query.match(/^\[[^\]]*\]$/) || exceptions.includes(query)) {
		return query;
	}
	return `(${query})`;
}

/** Remove parentheses from a BCQL query part if it's parenthesized */
export function unparenQueryPart(query?: string) {
	if (query) {
		query = query.trim();
		if (query.match(/^\([^)]+\)$/)) {
			const result = query.substring(1, query.length - 1);
			return result;
		}
	}
	return query;
}

export const getPatternString = (annotations: AppTypes.AnnotationValue[], withinClauses: Record<string, Record<string, string>>,
	parallelTargetVersions: string[] = [], alignBy?: string) => {

	const tokens = [] as string[][];

	annotations.forEach(annot => getAnnotationPatternString(annot).forEach((value, index) => {
		(tokens[index] = tokens[index] || []).push(value);
	}));

	let query = tokens.map(t => `[${t.join('&')}]`).join('');
	const queryGiven = query.length > 0;
	if (Object.keys(withinClauses).length > 0) {
		for (const [within, withinAttributes] of Object.entries(withinClauses)) {
			const attr = withinAttributes ? Object.entries(withinAttributes).filter(([k, v]) => !!v)
				.map(([k, v]) => ` ${k}="${v.replace(/"/g, '\\"')}"`).join('') : '';
			const tags = `<${within}${attr}/>`;
			if (queryGiven) {
				// Actual within
				query += ` within ${tags}`;
			} else {
				// No query given; just find the tags themselves
				if (query.length > 0)
					query += ' overlap ';
				query = tags;
			}
		}
	}

	if (parallelTargetVersions.length > 0) {
		const relationType = alignBy ?? '';
		query = `${parenQueryPart(query, ['[]*', '_'])}` + parallelTargetVersions.map(v => ` =${relationType}=>${v}? _`).join(' ; ');
	}

	return query || undefined;
};

function parenQueryPartParallel(query: string) {
	const parenExceptions = ['[]*', '_'];
	return parenQueryPart(query === '[]*' ? '_' : query, parenExceptions);
}

export const getPatternStringFromCql = (sourceCql: string, targetVersions: string[], targetCql: string[], alignBy?: string) => {
	if (targetVersions.length > targetCql.length) {
		console.error('There must be a CQL query for each selected parallel version!', targetVersions, targetCql);
		throw new Error(`There must be a CQL query for each selected parallel version!`);
	}

	if (targetVersions.length === 0) {
		return sourceCql;
	}

	const defaultSourceQuery = targetVersions.length > 0 ? '_': '';
	const queryParts = [parenQueryPartParallel(sourceCql.trim() || defaultSourceQuery)];
	const relationType = alignBy ?? '';
	for (let i = 0; i < targetVersions.length; i++) {
		if (i > 0)
			queryParts.push(' ; ');
		queryParts.push(` =${relationType}=>${targetVersions[i].trim()}? ${parenQueryPartParallel(targetCql[i].trim() || '_')}`)
	}

	const query = queryParts.join('');

	return query;
};

export function getDocumentUrl(
	pid: string,
	fieldName: string,
	searchField?: string, // if searchfield differs from field (parallel corpus)
	cql?: string,
	pattgapdata?: string,
	wordstart: number = 0,
	pageSize?: number,
	/** HACK: make the backend figure out which page to display based on the start index of the hit -- see ArticlePagination.vue/PaginationInfo.java */
	findHit?: number
) {

	cql = (cql || '').trim();
	pattgapdata = (pattgapdata || '').trim();
	if ((cql.length + pattgapdata.length) > 1000) { // server has issues with long urls
		cql = undefined;
		pattgapdata = undefined;
	}

	return new URI()
	.segment([CONTEXT_URL, INDEX_ID, 'docs', pid])
	.search({
		// parameter 'query' controls the hits that are highlighted in the document when it's opened
		field: fieldName,
		searchfield: searchField,
		query: cql || undefined,
		pattgapdata: pattgapdata || undefined,
		wordstart: pageSize != null ? (Math.floor(wordstart / pageSize) * pageSize) || undefined : undefined,
		findhit: findHit
	}).toString();
}

type KeysOfType<Base, Condition> = keyof Pick<Base, {
	[Key in keyof Base]: Base[Key] extends Condition ? Key : never
}[keyof Base]>;

/**
 * Returns a reducer function that will place all values into a map/object at the key defined by the passed string.
 * @param k key to pick from the objects
 * @param m optional mapping function to transform the objects after picking the key
 */
export function makeMapReducer<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(k: KeysOfType<T, string>, m?: V): (m: Record<string, ReturnType<V>>, t: T, i: number) => Record<string, ReturnType<V>> {
	return (acc: Record<string, ReturnType<V>>, v: T, i: number): Record<string, ReturnType<V>> => {
		const kv = v[k] as any as string;
		acc[kv] = m ? m(v, i) : v;
		return acc;
	};
}

export function makeMultimapReducer<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(k: KeysOfType<T, string>, m?: V): (m: Record<string, Array<ReturnType<V>>>, t: T, i: number) => Record<string, Array<ReturnType<V>>> {
	return (acc: Record<string, Array<ReturnType<V>>>, v: T, i: number): Record<string, Array<ReturnType<V>>> => {
		const kv = v[k] as any as string;
		acc[kv] ? acc[kv].push(m ? m(v, i) : v) : acc[kv] = [m ? m(v, i) : v];
		return acc;
	};
}

/**
 * Turn an array of strings into a map of type {[key: string]: true}.
 * Optionally mapping the values to be something other than "true".
 *
 * @param t the array of strings to place in a map.
 * @param m (optional) a mapping function to apply to values.
 */
export function mapReduce<VS extends (t: string, i: number) => any = (t: string, i: number) => true>(t: string[]|undefined|null, m?: VS): Record<string, ReturnType<VS>>;
/**
 * Turn an array of type T[] into a map of type {[key: string]: T}.
 * Optionally mapping the values to be something other than T.
 *
 * @param t the array of objects to place in a map.
 * @param k a key in the objects to use as key in the map.
 * @param m (optional) a mapping function to apply to values.
 */
export function mapReduce<T, VT extends (t: T, i: number) => any = (t: T, i: number) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: VT): Record<string, ReturnType<VT>>;
export function mapReduce<
	T,
	VT extends (t: T, i: number) => any = (t: T, i: number) => T,
	VS extends (t: string, i: number) => any = (t: string, i: number) => true
>(
	t: string[]|T[]|undefined|null,
	a?: VS|KeysOfType<T, string>,
	b?: VT
): any {
	if (t && t.length > 0 && typeof t[0] === 'string') {
		const values = t as string[];
		const mapper = a as VS|undefined;
		return values.reduce<Record<string, ReturnType<VS>>>((acc, cur, index) => {
			acc[cur] = mapper ? mapper(cur, index) : true;
			return acc;
		}, {});
	} else {
		const values = t as T[]|undefined|null;
		const key = a as KeysOfType<T, string>;
		const mapper = b as VT|undefined;
		return values ? values.reduce(makeMapReducer<T, VT>(key, b), {}) : {};
	}
}

/**
 * Turn an array of type T[] into a map of type {[key: string]: T[]};
 * Duplicate keys will be pushed into the array at that key in order of appearance.
 *
 * @param t the array of objects to place in a map.
 * @param k a key in the objects to use as key in the map.
 * @param m (optional) a mapping function to apply to values.
 */
export function multimapReduce<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: V): Record<string, Array<ReturnType<V>>> {
	return t ? t.reduce(makeMultimapReducer<T, V>(k, m), {}) : {};
}

export function filterDuplicates<T>(t: T[]|null|undefined, k: KeysOfType<T, string|number>): T[] {
	const found = new Set<T[KeysOfType<T, string|number>]>();
	return t ? t.filter(v => {
		if (!found.has(v[k])) {
			found.add(v[k]);
			return true;
		}
		return false;
	}) : [];
}

// --------------

/** Groups always have at least one member, empty array is returned if no groups would have members. */
export function fieldSubset<T extends {id: string}>(
	ids: string[],
	groups: Array<{id: string, entries: string[]}>,
	fields: Record<string, T>,
	addAllToOneGroup?: string
): Array<{id: string, entries: T[]}> {
	let ret: Array<{id: string, entries: T[]}> = groups
	.map(g => ({
		id: g.id,
		entries: g.entries.filter(e => ids.includes(e)).map(id => fields[id]),
	}))
	.filter(g => g.entries.length);

	if (addAllToOneGroup != null) {
		const seenIds = new Set<string>();
		const asOneGroup = { id: addAllToOneGroup, entries: [] as T[] };
		ret.forEach(group => {
			const unseenEntriesInGroup = group.entries.filter(entry => {
				const seen = seenIds.has(entry.id);
				seenIds.add(entry.id);
				return !seen;
			});
			asOneGroup.entries.push(...unseenEntriesInGroup);
		});
		ret = asOneGroup.entries.length ? [asOneGroup] : [];
	}
	return ret;
}

export function getMetadataSubset<T extends {id: string, displayName: string}>(
	ids: string[],
	groups: AppTypes.NormalizedMetadataGroup[],
	metadata: Record<string, T>,
	operation: 'Sort'|'Group',
	debug = false,
	/* show the <small/> labels at the end of options labels? */
	showGroupLabels = true
): Array<AppTypes.OptGroup&{entries: T[]}> {
	const defaultMetadataOptGroupName = 'Metadata';
	const subset = fieldSubset(ids, groups, metadata);

	function mapToOptions(value: string, displayName: string, groupId: string): AppTypes.Option[] {
		// @ts-ignore
		const displayIdHtml = debug ? `<small><strong>[id: ${value}]</strong></small>` : '';
		const displayNameHtml = displayName || value;
		const displaySuffixHtml = showGroupLabels && groupId ? `<small class="text-muted">${groupId}</small>` : '';
		const r: AppTypes.Option[] = [];
		r.push({
			value: operation === 'Sort' ? `field:${value}` : value, // groupby prepends field: on its own
			label: `${operation} by ${displayNameHtml} ${displayIdHtml} ${displaySuffixHtml}`,
		});
		if (operation === 'Sort') {
			r.push({
				value: `-field:${value}`,
				label: `${operation} by ${displayNameHtml} ${displayIdHtml} (descending) ${displaySuffixHtml}`,
			});
		}
		return r;
	}

	const r = subset.map<AppTypes.OptGroup&{entries: T[]}>(group => ({
		options: group.entries.flatMap(e => mapToOptions(e.id, e.displayName, group.id)),
		entries: group.entries,
		label: group.id
	}));

	// If there is only one metadata group to display: do not display the group names, instead display only 'Metadata'
	// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
	if (r.length === 1) { r[0].label = defaultMetadataOptGroupName; }
	return r;
}

/**
 * Given a list of annotation IDs, and some metadata about the corpus & annotations, convert them to a list of options for a <SelectPicker/>
 * @param ids the list of annotation IDs to keep
 * @param groups how annotations in the corpus are grouped into subsections. An annotation may be part of multiple groups.
 * @param annotations all annotations in the corpus
 * @param operation What section of the interface to generate the options list for: 'Search' will output every annotation only once per group, 'Sort' will generate additional entries to sort in reverse order, and 'Group' is just to generate appropriate option labels "Group by ...".
 * @param corpusTextDirection important for the order of left/right context sorting
 * @param debug is debug mode enabled? print raw annotation IDS in labels
 * @param showGroupLabels show little group name headers between options?
 */
export function getAnnotationSubset(
	ids: string[],
	groups: AppTypes.NormalizedAnnotationGroup[],
	annotations: Record<string, AppTypes.NormalizedAnnotation>,
	operation: 'Search'|'Sort'|'Group',
	corpusTextDirection: 'rtl'|'ltr' = 'ltr',
	debug = false,
	/* show the <small/> labels at the end of options labels? */
	showGroupLabels = true
): Array<AppTypes.OptGroup&{entries: AppTypes.NormalizedAnnotation[]}> {
	const subset = fieldSubset(ids, groups, annotations, operation !== 'Search' ? 'Other' : undefined);
	if (operation === 'Search')	{
		return subset.map(group => ({
			entries: group.entries,
			options: group.entries.map(a => ({
				value: a.id,
				label: a.displayName + (debug ? ` (id: ${a.id})` : ''),
				title: a.description
			})),
			label: group.id,
		}));
	}

	// If sorting: do left/right
	// if grouping: do wordleft/wordright
	// See https://github.com/INL/corpus-frontend/issues/316#issuecomment-609627245
	const operations = {
		left: operation === 'Group' ? 'wordleft:' : 'left:',
		right: operation === 'Group' ? 'wordright:' : 'right:'
	};

	return [
		['hit:', 'Hit', ''],
		[corpusTextDirection === 'rtl' ? operations.right : operations.left, 'Before hit', 'before'],
		[corpusTextDirection === 'rtl' ? operations.left : operations.right, 'After hit', 'after']
	]
	.map<AppTypes.OptGroup&{entries: AppTypes.NormalizedAnnotation[]}>(([prefix, groupname, suffix]) =>({
		label: groupname,
		entries: subset[0].entries,
		options: ids.flatMap(id => {
			// @ts-ignore
			const displayIdHtml = debug ? `<small><strong>[id: ${id}]</strong></small>` : '';
			const displayNameHtml = annotations[id].displayName || id; // in development mode - show IDs
			const displaySuffixHtml = showGroupLabels && suffix ? `<small class="text-muted">${suffix}</small>` : '';

			const r: AppTypes.Option[] = [];
			r.push({
				label: `${operation} by ${displayNameHtml} ${displayIdHtml} ${displaySuffixHtml}`,
				value: `${prefix}${id}`
			});
			if (operation === 'Sort') {
				r.push({
					label: `${operation} by ${displayNameHtml} ${displayIdHtml} (descending) ${displaySuffixHtml}`,
					value: `-${prefix}${id}`
				});
			}
			return r;
		})
	}));
}

/**
 * Find a the index of a value in the array using binary search.
 * @param a the array to search in
 * @param compare compare the current element, should return a negative number if the wanted element comes before the current element, a positive number if it comes after, and 0 if it is the wanted element.
 * @returns the index of the element in the array, or the negative index where it should be inserted.
 */
export function binarySearch<T>(a: T[], compare: (el: T) => number) {
	let low = 0;
	let high = a.length - 1;

	while (low <= high) {
		let mid = Math.floor(low + ((high - low) / 2));
		let midVal = a[mid];

		const cmp = compare(midVal);
		if (cmp > 0)
			low = mid + 1
		else if (cmp < 0)
			high = mid - 1;
		else
			return mid; // key found
	}
	return -low;  // key not found.
}

export function uniq<T>(l: T[]): T[] {return Array.from(new Set(l)).sort() }

/** Compile time checking: ensure the passed parameter is of the template type and return it (no-op).
 * Can use while setting variables initial value for example. */
export function cast<T>(t: T): T { return t; }

export const uiTypeSupport: {[key: string]: {[key: string]: Array<AppTypes.NormalizedAnnotation['uiType']>}} = {
	search: {
		simple: ['combobox', 'select', 'lexicon'],
		extended: ['combobox', 'select', 'pos'],
	},
	explore: {
		ngram: ['combobox', 'select']
	}
};

export function getCorrectUiType<T extends AppTypes.NormalizedAnnotation['uiType']>(allowed: T[], actual: T): T {
	return allowed.includes(actual) ? actual : 'text' as any;
}

import type {ModuleRootState as ModuleRootStateExplore} from '@/store/search/form/explore';
import type {ModuleRootState as ModuleRootStateSearch} from '@/store/search/form/patterns';
import cloneDeep from 'clone-deep';
export function getPatternStringExplore(
	subForm: keyof ModuleRootStateExplore,
	state: ModuleRootStateExplore,
	annots: Record<string, AppTypes.NormalizedAnnotation>
): string|undefined {
	switch (subForm) {
		case 'corpora': return undefined;
		case 'frequency': return '[]';
		case 'ngram': return state.ngram.tokens
				.slice(0, state.ngram.size)
				// type select because we only ever want to output one cql token per n-gram input
				.map(token => {
					const tokenType = annots[token.id].uiType;
					const correctedType = getCorrectUiType(uiTypeSupport.explore.ngram, tokenType);

					return token.value ? `[${token.id}="${escapeRegex(token.value, correctedType !== 'select').replace(/"/g, '\\"')}"]` : '[]';
				})
				.join('');
		default: throw new Error('Unknown submitted form - cannot generate cql query');
	}
}
export function getPatternStringSearch(
	subForm: keyof ModuleRootStateSearch,
	state: ModuleRootStateSearch,
	defaultAlignBy: string,
): string|undefined {
	// For the normal search form,
	// the simple and extended views require the values to be processed before converting them to cql.
	// The advanced and expert views already contain a good-to-go cql query. We only need to take care not to emit an empty string.
	const alignBy = state.parallelVersions.alignBy || defaultAlignBy;
	const targets = state.parallelVersions.targets || [];
	switch (subForm) {
		case 'simple':
			const q = state.simple.annotationValue.value ? [state.simple.annotationValue] : [];
			return q.length ?
				getPatternString(q, {}, targets, alignBy) :
				undefined;
		case 'extended': {
			const r = cloneDeep(Object.values(state.extended.annotationValues))
				.filter(annot => !!annot.value)
				.map(annot => ({
					...annot,
					type: getCorrectUiType(uiTypeSupport.search.extended, annot.type!)
				}));
			return r.length || Object.keys(state.extended.withinClauses).length > 0 ?
				getPatternString(r, state.extended.withinClauses, targets, alignBy) :
				undefined;
		}
		case 'advanced':
			if (!state.advanced.query)
				return undefined;
			return getPatternStringFromCql(state.advanced.query, targets, state.advanced.targetQueries, alignBy);
		case 'expert':
			return getPatternStringFromCql(state.expert.query || '', targets, state.expert.targetQueries, alignBy);
		case 'concept': return state.concept?.trim() || undefined;
		case 'glosses': return state.glosses?.trim() || undefined;
		default: throw new Error('Unimplemented pattern generation.');
	}

}

export function getPatternSummaryExplore<K extends keyof ModuleRootStateExplore>(
	subForm: K,
	state: ModuleRootStateExplore,
	annots: Record<string, AppTypes.NormalizedAnnotation>
): string|undefined {
	switch (subForm) {
		case 'corpora': return undefined;
		case 'frequency': return `${annots[state.frequency.annotationId].displayName} frequency`;
		case 'ngram': return `${annots[state.ngram.groupAnnotationId].displayName} ${state.ngram.size}-grams`
		default: return undefined;
	}
}
export function getPatternSummarySearch<K extends keyof ModuleRootStateSearch>(
	subForm: K,
	state: ModuleRootStateSearch,
	defaultAlignBy: string,
) {
	const patt = getPatternStringSearch(subForm, state, defaultAlignBy);
	return patt?.replace(/\\(.)/g, '$1') || '';

	// For the normal search form,
	// the simple and extended views require the values to be processed before converting them to cql.
	// The advanced and expert views already contain a good-to-go cql query. We only need to take care not to emit an empty string.
	// switch (subForm) {
	// 	case 'simple': return state.simple.annotationValue.value || undefined;
	// 	case 'extended': {
	// 		const annotations: AppTypes.AnnotationValue[] = cloneDeep(Object.values(state.extended.annotationValues).filter(annot => !!annot.value))
	// 			.map(annot => ({
	// 				...annot,
	// 				type: getCorrectUiType(uiTypeSupport.search.extended, annot.type!)
	// 			}));
	// 		if (annotations.length === 0) { return undefined; }
	// 		// remove escape backslashes as this is just a summary
	// 		return getPatternString(annotations, state.extended.within, alignBy, state.parallelVersions?.targets || [])?.replace(/\\(.)/g, '$1');
	// 	}
	// 	case 'advanced': return state.advanced.query?.trim() || undefined;
	// 	case 'expert': return state.expert.query?.trim() || undefined;
	// 	case 'concept': return state.concept || undefined;
	// 	case 'glosses': return state.glosses || undefined;
	// 	default: return undefined;
	// }
}

