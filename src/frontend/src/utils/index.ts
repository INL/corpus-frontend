import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { arrayMax } from 'highcharts';

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
 * @param hit - the hit, or most of the hit in case of doc results (which contain less info than hits)
 * @param prop - annotation to print, usually 'word'.
 * @returns string[3] where [0] == before, [1] == hit and [2] == after, values are strings created by
 * concatenating and alternating the punctuation and values itself
 */
export function snippetParts(hit: BLTypes.BLHit|BLTypes.BLHitSnippet, prop: string): [string, string, string] {
	const punctAfterLeft = hit.match[prop].length > 0 ? hit.match.punct[0] : '';
	const before = hit.left ? wordsWithCaptures(hit, hit.left, prop, false, punctAfterLeft) : '';
	const match = wordsWithCaptures(hit, hit.match, prop, false, ''); // Jesse
	const after = hit.right ? wordsWithCaptures(hit, hit.right, prop, true, '') : '';
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

interface int2string {
    [key: number]:  string;
}

// ugly thing that should be in state

interface string2int {
	[key: string]:  number;
}

const capturename2index : string2int = {}; // Jesse, gruwelijk

// add styling to captures, in a hacky way. breaks clicking on concordance to get quotation!
// Test with e.g. ((<s/> containing a:[word='man']) containing  b:[word='Socrates']) containing c:[word='morta.*'] in quine corpus

/** hit is not always a full-fledged hit object, for doc results, we have less information. So ensure this function works with both BLHit and BLHitSnippet. */
export function wordsWithCaptures(hit: BLTypes.BLHitSnippet|BLTypes.BLHit, context: BLTypes.BLHitSnippetPart, prop: string, doPunctBefore: boolean, addPunctAfter: string): string { // Jesse
	const parts = [] as string[];
	const numTokens = context[prop] ? context[prop].length : 0;
	const p2c: int2string = {};

	if (hit.captureGroups && 'start' in hit)  {
		const start = hit.start;
		hit.captureGroups.forEach(g => {
			const name = g.name;
			if (!(name in capturename2index)) {
				capturename2index[name] = Object.keys(capturename2index).length;
			}
			const gs = g.start - start;
			const ge = g.end - start;
			for (let k=gs; k < ge; k++) p2c[k] = name;
		});
	}

	for (let i = 0; i < numTokens; i++) {
		if (i > 0 || doPunctBefore) {
			parts.push(context.punct[i] || '');
		}
		const w = context[prop][i];
		const w_i = i in p2c
			? `<span style="font-style:italic" title="capture: ${p2c[i]}" class='capture capture_${capturename2index[p2c[i]]}'>${w}</span>`
			: w;
		parts.push(w_i);
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
			debugger;
		}
	})
});

export const getPatternString = (annotations: AppTypes.AnnotationValue[], within: null|string) => {
	const tokens = [] as string[][];

	annotations.forEach(annot => getAnnotationPatternString(annot).forEach((value, index) => {
		(tokens[index] = tokens[index] || []).push(value);
	}));

	let query = tokens.map(t => `[${t.join('&')}]`).join('');
	if (query.length > 0 && within) {
		query += ` within <${within}/>`;
	}
	return query || undefined;
};

// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
// Have a configurable url in the backend that's made available on the client that we can use here.
export function getDocumentUrl(
	pid: string,
	cql?: string,
	pattgapdata?: string,
	wordstart: number = 0,
	pageSize?: number,
	/** HACK: Find the hit starting with this word index on the page -- see ArticlePagination.vue */
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
		query: cql || undefined,
		pattgapdata: pattgapdata || undefined,
		wordstart: pageSize != null ? (Math.floor(wordstart / pageSize) * pageSize) || undefined : undefined,
		findhit: findHit
	}).toString();
}

export type MapOf<T> = {
	[key: string]: T;
};

type KeysOfType<Base, Condition> = keyof Pick<Base, {
	[Key in keyof Base]: Base[Key] extends Condition ? Key : never
}[keyof Base]>;

/**
 * Returns a reducer function that will place all values into a map/object at the key defined by the passed string.
 * @param k key to pick from the objects
 * @param m optional mapping function to transform the objects after picking the key
 */
export function makeMapReducer<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(k: KeysOfType<T, string>, m?: V): (m: MapOf<ReturnType<V>>, t: T, i: number) => MapOf<ReturnType<V>> {
	return (acc: MapOf<ReturnType<V>>, v: T, i: number): MapOf<ReturnType<V>> => {
		const kv = v[k] as any as string;
		acc[kv] = m ? m(v, i) : v;
		return acc;
	};
}

export function makeMultimapReducer<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(k: KeysOfType<T, string>, m?: V): (m: MapOf<Array<ReturnType<V>>>, t: T, i: number) => MapOf<Array<ReturnType<V>>> {
	return (acc: MapOf<Array<ReturnType<V>>>, v: T, i: number): MapOf<Array<ReturnType<V>>> => {
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
export function mapReduce<VS extends (t: string, i: number) => any = (t: string, i: number) => true>(t: string[]|undefined|null, m?: VS): MapOf<ReturnType<VS>>;
/**
 * Turn an array of type T[] into a map of type {[key: string]: T}.
 * Optionally mapping the values to be something other than "true".
 *
 * @param t the array of objects to place in a map.
 * @param k a key in the objects to use as key in the map.
 * @param m (optional) a mapping function to apply to values.
 */
export function mapReduce<T, VT extends (t: T, i: number) => any = (t: T, i: number) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: VT): MapOf<ReturnType<VT>>;
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
		return values.reduce<MapOf<ReturnType<VS>>>((acc, cur, index) => {
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
export function multimapReduce<T, V extends (t: T, i: number) => any = (t: T, i: number) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: V): MapOf<Array<ReturnType<V>>> {
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
	fields: MapOf<T>,
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
	metadata: MapOf<T>,
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
			value: `field:${value}`,
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
	annotations: MapOf<AppTypes.NormalizedAnnotation>,
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

export function uniq<T>(l: T[]): T[] {return Array.from(new Set(l)).sort() }


/**
 * Parse a GroupBy string. It should be pre-separated on comma's.
 * http://inl.github.io/BlackLab/blacklab-server-overview.html#sorting-grouping-filtering-faceting
 */
export function parseGroupBy(groupBy: string[]): AppTypes.GroupBySettings[] {
	return groupBy.map<AppTypes.GroupBySettings>(part => {
		const [type] = part.split(':', 1);

		switch (type) {
			// grouping by metadata
			case 'field': return cast<AppTypes.GroupByMetadataSettings>({
				type: 'metadata',
				field: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's'
			});

			// grouping by capture
			case 'capture': return cast<AppTypes.GroupByCaptureSettings>({
				type: 'capture',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				groupname: part.split(':')[3]
			});

			// grouping by words in/around the hit
			case 'hit': return cast<AppTypes.GroupByContextSettings>({
				type: 'annotation',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				position: 'H', // 'H' is the hit itself
				start: 1,
			})
			case 'left':
			case 'before':
			case 'right':
			case 'after': return cast<AppTypes.GroupByContextSettings>({
				type: 'annotation',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				position: (type === 'left' || type === 'before') ? 'L' : 'R',
				start: Number(part.split(':')[3]) || 1, // if no start was given, Number will create NaN, which we replace with 1 (i.e. start of section)
				end: Number(part.split(':')[3]) || undefined // start and end are the same for this
			});
			// deprecated, but parse into before/after:1
			case 'wordleft':
			case 'wordright': return cast<AppTypes.GroupByContextSettings>({
				type: 'annotation',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				position: type === 'wordleft' ? 'L' : 'R',
				start: 1,
				end: 1
			});
			// grouping by specific context (e.g. at (a) specific offset(s) within/before/after the hit)
			case 'context': return cast<AppTypes.GroupByContextSettings>({
				type: 'annotation',
				annotation: part.split(':')[1],
				caseSensitive: part.split(':')[2] === 's',
				position: part.split(':')[3][0] as 'L'|'R'|'H'|'E',
				start: Number(part.split(':')[3].match(/\w(\d+)/)![1]),
				end: Number(part.split(':')[3].match(/\w\d+-(\d+)?/)?.[1]) || undefined // again with the NaN to undefined.
			});
			default: throw new Error('Unimplemented groupby type: ' + type);
		}
	});
}

export function serializeGroupBy(groupBy: AppTypes.GroupBySettings): string;
export function serializeGroupBy(groupBy: AppTypes.GroupBySettings[]): string[]
export function serializeGroupBy(groupBy: AppTypes.GroupBySettings|AppTypes.GroupBySettings[]): string|string[] {
	function single(g: AppTypes.GroupBySettings): string {
		switch (g.type) {
			case 'metadata': return `field:${g.field}:${g.caseSensitive ? 's' : 'i'}`;
			case 'annotation': return `context:${g.annotation}:${g.caseSensitive ? 's' : 'i'}:${g.position}${g.start}${g.end ? '-' + g.end : ''}`;
			case 'capture': return `capture:${g.annotation}:${g.caseSensitive ? 's' : 'i'}:${g.groupname}`;
			// @ts-ignore
			default: throw new Error('Unimplemented groupby type: ' + g.type);
		}
	};

	return Array.isArray(groupBy) ? groupBy.map(single) : single(groupBy);
}

/** We use a weird almost untyped object in the groupby builder because it's much easier to attach to the UI this way. */
export type GroupBySettings2 = {
	type: 'annotation'|'metadata',
	/** only used when type === 'annotation' */
	annotation: string,
	/** Always relevant */
	caseSensitive: boolean,
	/** when undefined, use groupname instead of positional, and ignore start+end */
	position: 'L'|'H'|'R'|'E'|undefined,
	start: number,
	/** only used when position != null. When blank, entire context is used.  */
	end: number|undefined,
	/** only used when type === 'metadata' */
	field: string,
	/** Only used when type === 'annotation' && position == null */
	groupname: string,
};

/** Interop between the UI object and the formal groupby object. Invalid objects will be filtered out. */
export function serializeGroupBy2(g: GroupBySettings2[]): string[];
/** Interop between the UI object and the formal groupby object. Invalid objects will result in an invalid string. */
export function serializeGroupBy2(g: GroupBySettings2, filter: false): string;
/** Interop between the UI object and the formal groupby object. Invalid objects will result in undefined. */
export function serializeGroupBy2(g: GroupBySettings2): string|undefined;
/** Interop between the UI object and the formal groupby object. Invalid objects will result in undefined. */
export function serializeGroupBy2(g: GroupBySettings2, filter: true): string|undefined;
export function serializeGroupBy2(g: GroupBySettings2|GroupBySettings2[], filter = true): string|string[]|undefined {
	function serialize(g: GroupBySettings2): string|undefined {
		const cs = g.caseSensitive ? 's' : 'i';

		switch (g.type) {
			case 'metadata': {
				if (!g.field && filter) return undefined;
				return `field:${g.field}:${cs}`;
			}
			case 'annotation': {
				if (!g.annotation && filter) return undefined;
				if (g.position == null) {
					if (!g.groupname && filter) return undefined;
					return `capture:${g.annotation}:${cs}:${g.groupname}`;
				}
				if (g.start == null && filter) return undefined;
				return `context:${g.annotation}:${cs}:${g.position}${g.start}${g.end != null ? '-' + g.end : ''}`;
			}
			default: {
				if (g.type != null) console.error(`Unknown grouping property ${g.type}. Cannot create string for BlackLab.`);
				return undefined;
			}
		}
	}

	if (Array.isArray(g)) {
		filter = true;
		return g.map(serialize).filter(g => g != null) as string[]
	}
	else return serialize(g);

}

/** Interop between the UI object and the formal groupby object. */
export function parseGroupBy2(groupby: string): GroupBySettings2 {
	const g = parseGroupBy([groupby])[0];

	return {
		type: g.type === 'metadata'? 'metadata' : 'annotation',
		field: g.type === 'metadata' ? g.field : '',
		annotation: g.type === 'metadata' ? '' : g.annotation,
		caseSensitive: g.caseSensitive,
		end: g.type === 'annotation' ? g.end || 1 : 1,
		groupname: g.type === 'capture' ? g.groupname : '',
		position: g.type === 'annotation' ? g.position : undefined,
		start: g.type === 'annotation' ? g.start : 1
	}
}

/** Compile time checking: ensure the passed parameter is of the template type and return it (no-op).
 * Can use while setting variables initial value for example. */
export function cast<T>(t: T): T { return t; }
