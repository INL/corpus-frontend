import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { FilterState, FullFilterState } from '@/store/search/form/filters';

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
	return original.replace(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|]|\^|"|~|:|\\)/g, '\\$1');
}

/** Unescapes every lucene special character including double quotes, except wildcards */
export function unescapeLucene(original: string) {
	if (original.startsWith('"') && original.endsWith('"') && !original.endsWith('\\"')) {
		return original.substr(1, original.length - 2).replace(/\\(")/g, '$1');
	}

	return original.replace(/\\(\+|-|&&|\|\||!|\(|\)|{|}|\[|]|\^|"|~|:|\\|\*|\?)/g, '$1');
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

	// const filterStrings = [] as string[];

	// for (const filter of filters) {
	// 	if (!filter.values.length) {
	// 		continue;
	// 	}

	// 	if (filterStrings.length) {
	// 		filterStrings.push(' AND ');
	// 	}

	// 	switch (filter.type) {
	// 		case 'range': {
	// 			// NOTE: range filter has hidden defaults for unset field (min, max), see https://github.com/INL/corpus-frontend/issues/234
	// 			filterStrings.push(filter.id, ':', '[', filter.values[0] || '0', ' TO ', filter.values[1] || '9999', ']');
	// 			break;
	// 		}
	// 		case 'select':
	// 		case 'checkbox':
	// 		case 'radio': {
	// 			// Values for these uiTypes are predetermined (i.e. user can't type in these fields)
	// 			// So copy out the values without wildcard substitution or regex escaping.
	// 			// Surround each individual values with quotes, and surround the total with brackets
	// 			filterStrings.push(filter.id, ':', '("', filter.values.join('" "'), '")');
	// 			break;
	// 		}
	// 		case 'text':
	// 		case 'combobox': {
	// 			const resultParts = [] as string[];

	// 			filter.values.forEach(value => {
	// 				const quotedParts = value.split(/"/);
	// 				let inQuotes = false;
	// 				for (let part of quotedParts) {
	// 					if (inQuotes && part.match(/\s+/)) {
	// 						// Inside quotes and containing whitespace.
	// 						// Preserve the quotes, they will implicitly escape every special character inside the string
	// 						// NOTE: wildcards do not work for phrases anyway. (https://lucene.apache.org/core/2_9_4/queryparsersyntax.html#Wildcard%20Searches)
	// 						resultParts.push(' "');
	// 						resultParts.push(part);
	// 						resultParts.push('"');
	// 					} else {
	// 						// Outside quotes. Split on whitespace and escape (excluding wildcards) the strings
	// 						// This means wildcards are preserved.
	// 						// NOTE: we need to account for this by checking whether any term contains whitespace
	// 						// while deserializing the lucene query, and reverse this escaping.
	// 						// This is done in UrlStateParser
	// 						part = part.trim();
	// 						if (part.length > 0) {
	// 							// resultParts.push(' "');
	// 							resultParts.push(...part.split(/\s+/).map(escapeLucene));
	// 							// resultParts.push(part.split(/\s+/).join('" "'));
	// 							// resultParts.push('" ');
	// 						}
	// 					}
	// 					inQuotes = !inQuotes;
	// 				}
	// 			});

	// 			filterStrings.push(filter.id, ':', '(' + resultParts.join('').trim(), ')');
	// 			break;
	// 		}
	// 		default: {
	// 			// This should never happen unless new uiTypes are added
	// 			// in which case, maybe the values need to be handled in a special way
	// 			throw new Error('Unimplemented value serialization for metadata filter uiType ' + filter.type + '!');
	// 		}
	// 	}
	// }

	// return filterStrings.join('') || undefined;
}

// NOTE: range filter has hidden defaults for unset field (min, max), see https://github.com/INL/corpus-frontend/issues/234
export const getFilterSummary = (filters: FullFilterState[]): string|undefined => filters
	.filter(f => !!f.lucene && !!f.summary)
	.map(f => `${f.displayName}: ${f.summary}`)
	.join(', ') || undefined;

export const getFilterSummaryOld = (filters: AppTypes.FilterValue[]) => filters
	.map(({id, type, values}) =>
		`${id} = [${type==='range'?`${values[0] || '0'} to ${values[1] || '9999'}`:values.join(', ')}]`).join(', ');

export const getPatternString = (annotations: AppTypes.AnnotationValue[], within: null|string) => {
	const tokens = [] as string[][];

	annotations.forEach(({id, case: caseSensitive, value, type}) => {
		switch (type) {
			case 'pos': {
				const arr = (tokens[0] = tokens[0] || []);
				arr.push(value); // already valid cql, no escaping or wildcard substitution.
				return;
			}
			case 'select':
			case 'text':
			case 'combobox': {
				value
				.replace(/"/g, '')
				.trim()
				.split(/\s+/)
				.filter(v => !!v)
				.forEach((word, i) => {
					const arr = (tokens[i] = tokens[i] || []);
					arr.push(`${id}="${(caseSensitive ? '(?-i)' : '') + makeWildcardRegex(word)}"`);
				});
				return;
			}
			default: throw new Error('Unimplemented cql serialization for annotation type ' + type);
		}
	});

	let query = tokens.map(t => `[${t.join('&')}]`).join('');
	if (query.length > 0 && within) {
		query += ` within <${within}/>`;
	}
	return query || undefined;
};

// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
// Have a configurable url in the backend that's made available on the client that we can use here.
export function getDocumentUrl(pid: string, cql: string|null, pattgapdata: string|null, wordstart: number = 0, pageSize: number = 5000) {
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
		cql = null;
		pattgapdata = null;
	}

	return docUrl
		.absoluteTo(new URI().toString())
		.filename(pid)
		.search({
			// parameter 'query' controls the hits that are highlighted in the document when it's opened
			query: cql || undefined,
			pattgapdata: pattgapdata || undefined,
			wordstart: (Math.floor(wordstart / pageSize) * pageSize) || undefined
		})
		.toString();
}

export type MapOf<T> = {
	[key: string]: T;
};

type KeysOfType<Base, Condition> = keyof Pick<Base, {
	[Key in keyof Base]: Base[Key] extends Condition ? Key : never
}[keyof Base]>;

export function makeMapReducer<T, V extends (t: T) => any = (t: T) => T>(k: KeysOfType<T, string>, m?: V): (m: MapOf<ReturnType<V>>, t: T) => MapOf<ReturnType<V>> {
	return (acc: MapOf<ReturnType<V>>, v: T): MapOf<ReturnType<V>> => {
		const kv = v[k] as any as string;
		acc[kv] = m ? m(v) : v;
		return acc;
	};
}

export function makeMultimapReducer<T, V extends (t: T) => any = (t: T) => T>(k: KeysOfType<T, string>, m?: V): (m: MapOf<Array<ReturnType<V>>>, t: T) => MapOf<Array<ReturnType<V>>> {
	return (acc: MapOf<Array<ReturnType<V>>>, v: T): MapOf<Array<ReturnType<V>>> => {
		const kv = v[k] as any as string;
		acc[kv] ? acc[kv].push(m ? m(v) : v) : acc[kv] = [m ? m(v) : v];
		return acc;
	};
}

/**
 * Turn an array of type T[] into a map of type {[key: string]: T};
 * @param t the array of objects to place in a map.
 * @param k a key in the objects to use as key in the map.
 * @param m (optional) a mapping function to apply to values.
 */
export function mapReduce<T, V extends (t: T) => any = (t: T) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: V): MapOf<ReturnType<V>> {
	return t ? t.reduce(makeMapReducer<T>(k, m), {}) : {};
}

/**
 * Turn an array of type T[] into a map of type {[key: string]: T[]};
 * Duplicate keys will be pushed into the array at that key in order of appearance.
 *
 * @param t the array of objects to place in a map.
 * @param k a key in the objects to use as key in the map.
 * @param m (optional) a mapping function to apply to values.
 */
export function multimapReduce<T, V extends (t: T) => any = (t: T) => T>(t: T[]|undefined|null, k: KeysOfType<T, string>, m?: V): MapOf<Array<ReturnType<V>>> {
	return t ? t.reduce(makeMultimapReducer<T>(k, m), {}) : {};
}

// --------------

export function groupByOptionsFromAnnotations(ids: string[], annots: MapOf<AppTypes.NormalizedAnnotation[]>): AppTypes.OptGroup[] {
	// NOTE: grouping on annotations without a forward index is not supported - however has already been checked in the UIStore
	return [
		['hit:', 'Hit', ''],
		['wordleft:', 'Before hit', 'before'],
		['wordright:', 'After hit', 'after']
	]
	.map<AppTypes.OptGroup>(([prefix, groupname, suffix]) =>({
		label: groupname,
		options: ids.map(id => ({
			label: `Group by ${annots[id][0].displayName || id} <small class="text-muted">${suffix}</small>`,
			value: `${prefix}${id}`
		}))
	}));
}

export function groupByOptionsFromMetadata(ids: string[], metadataFields: MapOf<AppTypes.NormalizedMetadataField>): AppTypes.OptGroup[] {
	// So recreate the groups and add everything that's not in the form into a default fallback group.
	const metadataGroupsToShow: MapOf<AppTypes.Option[]&{groupIndex: number}> = {};

	let groupIndex = 0;
	ids.forEach(id => {
		const {displayName, groupId = 'Metadata'} = metadataFields[id];

		if (!metadataGroupsToShow[groupId]) {
			metadataGroupsToShow[groupId] = [] as any;
			metadataGroupsToShow[groupId].groupIndex = groupId === 'Metadata' ? Number.MAX_SAFE_INTEGER : groupIndex++;
		}

		metadataGroupsToShow[groupId].push({
			value: `field:${id}`,
			label: `Group by ${(displayName || id).replace(groupId, '')} <small class="text-muted">(${groupId})</small>`,
		});
	});

	const metadataOptGroups =
	Object.entries(metadataGroupsToShow).sort((a, b) => a[1].groupIndex - b[1].groupIndex)
	.map(([groupName, fieldsInGroup]) => ({
		label: groupName,
		options: fieldsInGroup
	}));

	// If there is only one metadata group to display: do not display the groups's name, instead display only 'Metadata'
	// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
	if (metadataOptGroups.length === 1) {
		metadataOptGroups.forEach(g => g.label = 'Metadata');
	}
	return metadataOptGroups;
}
