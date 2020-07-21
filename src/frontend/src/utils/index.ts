import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { FilterState, FullFilterState } from '@/store/search/form/filters';
import { RemoveProperties } from '@/types/helpers';

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
		return `"${original.replace(/"/g, '\\$1')}"`;
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
export function getFilterString(filters: FilterState[]): string|undefined {
	return filters.map(f => f.lucene).filter(lucene => !!lucene).join(' AND ') || undefined;
}

// NOTE: range filter has hidden defaults for unset field (min, max), see https://github.com/INL/corpus-frontend/issues/234
export const getFilterSummary = (filters: FullFilterState[]): string|undefined => filters
	.filter(f => !!f.lucene && !!f.summary)
	.map(f => `${f.displayName}: ${f.summary}`)
	.join(', ') || undefined;

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
			let resultParts = value
			.trim()
			.split(/"/)
			.flatMap((v, i) => {
				if (!v) {
					return [];
				}
				const inQuotes = (i % 2) !== 0;
				// alrighty,
				// "split word" behind another few --> ["split word", "behind", "another", "few"]
				// "wild* in split words" and such --> ["wild.* in split words", "and", "such"]
				return inQuotes ? escapeRegex(v, true) : v.split(/\s+/).filter(s => !!s).map(val => escapeRegex(val, true));
			});
			if (caseSensitive) {
				resultParts = resultParts.map(v => `(?-i)${v}`);
			}

			return resultParts.map(word => `${id}="${word}"`);
		}
		default: throw new Error('Unimplemented cql serialization for annotation type ' + type);
	}
};

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

	cql = (cql || '').trim();
	pattgapdata = (pattgapdata || '').trim();
	if ((cql.length + pattgapdata.length) > 1000) { // server has issues with long urls
		cql = undefined;
		pattgapdata = undefined;
	}

	return docUrl
		.absoluteTo(new URI().toString())
		.filename(pid)
		.search({
			// parameter 'query' controls the hits that are highlighted in the document when it's opened
			query: cql || undefined,
			pattgapdata: pattgapdata || undefined,
			wordstart: pageSize != null ? (Math.floor(wordstart / pageSize) * pageSize) || undefined : undefined,
			findhit: findHit
		})
		.toString();
}

export type MapOf<T> = {
	[key: string]: T;
};

type KeysOfType<Base, Condition> = keyof Pick<Base, {
	[Key in keyof Base]: Base[Key] extends Condition ? Key : never
}[keyof Base]>;

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

/**
 * Transforms the list of annotation ids into a list of groups containing the full annotation info.
 * Returned groups are sorted based on global group order.
 *
 * NOTE: groups are formed based on the groupId property of the individual fields.
 * We only use the list from blacklab (the "groups" argument) to determine the order of groups.
 */
export function annotationGroups(
	ids: string[],
	annots: MapOf<AppTypes.NormalizedAnnotation[]>,
	groups: AppTypes.NormalizedIndex['annotationGroups'],
	defaultGroupName = 'Other'
): Array<{groupId: string, annotations: AppTypes.NormalizedAnnotation[]}> {
	const groupOrder = groups.map(g => g.name);
	const groupsMap = multimapReduce(
		ids.map(id => annots[id][0] as Required<AppTypes.NormalizedAnnotation>) ,
		'groupId',
	);
	const sortedGroupsArray = Object.entries(groupsMap)
	.map(([groupId, entries]) => ({groupId: groupId !== 'undefined' ? groupId : defaultGroupName, annotations: entries}))
	.sort(({groupId: a}, {groupId: b}) => a === defaultGroupName ? 1 : b === defaultGroupName ? -1 : groupOrder.indexOf(a) - groupOrder.indexOf(b));

	// If there is only one metadata group to display: do not display the group names, instead display only 'Other'
	// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
	if (sortedGroupsArray.length === 1) {
		sortedGroupsArray.forEach(g => g.groupId = defaultGroupName);
	}
	return sortedGroupsArray;
}

export function selectPickerAnnotationOptions(ids: string[], annots: MapOf<AppTypes.NormalizedAnnotation[]>, operation: 'Group'|'Sort', corpusTextDirection: 'ltr'|'rtl'): AppTypes.OptGroup[] {
	// NOTE: grouping on annotations without a forward index is not supported - however has already been checked in the UIStore
	return [
		['hit:', 'Hit', ''],
		[corpusTextDirection === 'rtl' ? 'right:' : 'left:', 'Before hit', 'before'],
		[corpusTextDirection === 'rtl' ? 'left:' : 'right:', 'After hit', 'after']
	]
	.map<AppTypes.OptGroup>(([prefix, groupname, suffix]) =>({
		label: groupname,
		options: ids.map(id => ({
			label: `${operation} by ${annots[id][0].displayName || id} <small class="text-muted">${suffix}</small>`,
			value: `${prefix}${id}`
		}))
	}));
}

/**
 * NOTE: groups are formed based on the groupId property of the individual fields.
 * We only use the list from blacklab (the "groups" argument) to determined the order of groups.
 * This is because there may exist filter/metadata fields that do not exist in blacklab.
 * These fields' groups are not present in the groups array.
 */
export function metadataGroups<T extends {id: string, groupId?: string}>(
	ids: string[],
	fields: MapOf<T>,
	groups: AppTypes.NormalizedIndex['metadataFieldGroups'],
	defaultGroupName = 'Metadata'
): Array<{groupId: string, fields: T[]}> {
	const groupOrder = groups.map(g => g.name).concat(defaultGroupName); // fallback group at the end.
	const groupsMap = multimapReduce(
		ids.map(id => fields[id] as any), // just pretend groupId exists, even if it's undefined it's fine and we handle that.
		'groupId'
	);
	const sortedGroupsArray = Object.entries(groupsMap)
	.map(([groupId, entries]) => ({groupId: groupId !== 'undefined' ? groupId : defaultGroupName, fields: entries}))
	.sort(({groupId: a}, {groupId: b}) => a === defaultGroupName ? 1 : b === defaultGroupName ? -1 : groupOrder.indexOf(a) - groupOrder.indexOf(b));

	// If there is only one metadata group to display: do not display the group names, instead display only 'Metadata'
	// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
	if (sortedGroupsArray.length === 1) {
		sortedGroupsArray.forEach(g => g.groupId = defaultGroupName);
	}
	return sortedGroupsArray;
}

export function selectPickerMetadataOptions(
	ids: string[],
	fields: MapOf<AppTypes.NormalizedMetadataField>,
	groups: AppTypes.NormalizedIndex['metadataFieldGroups'],
	operation: 'Group'|'Sort'
): AppTypes.OptGroup[] {
	return metadataGroups(ids, fields, groups)
	.map<AppTypes.OptGroup>(g => ({
		label: g.groupId,
		options: g.fields.map(({id, displayName}) => ({
			value: `field:${id}`,
			label: `${operation} by ${(displayName || id)} <small class="text-muted">(${g.groupId})</small>`,
		}))
	}));
}
