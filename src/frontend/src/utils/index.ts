import URI from 'urijs';

import * as BLTypes from '@/types/blacklabtypes';

import {RootState} from '@/store';

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

type PatternType = RootState['form']['pattern'][RootState['form']['activePattern']];

// TODO update documentation
/**
 * Converts an array of PropertyFields to a cql token string.
 * If pattern is a string already, it is returned as-is.
 * Every PropertyField value is split on whitespace, and every word is mapped to a token with the same index.
 * I.E. lemma="multiple words" is converted to [lemma="multiple"][lemma="words"]
 * Values are converted from wildcard to regex, and case sensitivity flags are inserted where case-sensitive searching is specified.
 * @param pattern
 * @param within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
 * @returns The formatted string
 */
export function getPatternString(pattern: PatternType): string|undefined {
	if (!pattern) {
		return undefined;
	}
	if (typeof pattern === 'string') {
		return pattern.trim() || undefined; // coerce empty to undef
	}

	// First split the properties into individual words and pair them
	const tokens = [] as Array<{[key: string]: string}>;
	for (const field of Object.values(pattern.annotationValues)) {
		if (field.value.length === 0) {
			continue;
		}

		const words = field.value.trim().split(/\s+/);
		for (let i = 0; i < words.length; i++) {
			if (!tokens[i]) {
				tokens[i] = {};
			}

			tokens[i][field.id] = (field.case ? '(?-i)' : '') + makeWildcardRegex(words[i]);
		}
	}

	const tokenStrings = [] as string[];
	$.each(tokens, function(index, token) {

		// push all attributes in this token
		const attributesStrings = [] as string[];
		$.each(token, function(key, value) {
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
 * Encodes search parameters into a page url as understood by fromPageUrl().
 * N.B. we assume we're mounted under /<contextRoot>/<corpus>/search/[hits|docs][/]?query=...
 * The contextRoot can be anything, even multiple segments (due to reverse proxy, different WAR deploy path, etc)
 * But we assume the /search/ part still exists.
 *
 * Removes any empty strings, arrays, null, undefineds prior to conversion, to shorten the resulting query string.
 *
 * @param searchParams the search parameters
 * @returns the query string, beginning with ?, or an empty string when no searchParams with a proper value
 */
export function toPageUrl(operation: string, blsParams?: BLTypes.BlacklabParameters|null) {
	const uri = new URI();
	const paths = uri.segmentCoded();
	const basePath = paths.slice(0, paths.lastIndexOf('search')+1);
	// basePath now contains our url path, up to and including /search/

	// If we're not searching, return a bare url pointing to /search/
	if (blsParams == null) {
		return uri.directory(basePath.join('')).search('').toString();
	}

	// remove null, undefined, empty strings and empty arrays from our query params
	const modifiedParams: Partial<BLTypes.BlacklabParameters> = {};
	$.each(blsParams, function(key, value) {
		if (value == null) {
			return true;
		}
		if ((value as any).length === 0) { // TODO
			return true;
		}
		modifiedParams[key] = value;
	});

	// Append the operation, query params, etc, and return.
	return uri.segmentCoded(basePath).segmentCoded(operation).search(modifiedParams).toString();
}
