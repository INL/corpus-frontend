import $ from 'jquery';
import URI from 'urijs';

import luceneQueryParser from 'lucene-query-parser';

import parseCql from '../utils/cqlparser';
import {debugLog} from '../utils/debug';

import {FilterField, PropertyField} from '../types/pagetypes';
import {makeRegexWildcard, makeWildcardRegex} from '../utils';
import parseLucene from '../utils/lucene2filterparser';

/**
 * Converts search parameters into a query for blacklab-server and executes it.
 * Also handles getting data such as longer snippets, concordances, etc.
 */

export type SearchParameters = {
	/* The main type of data to request, is transformed to the path of the search url, as in blacklab-server/corpusId/<operation>?parameters */
	operation: 'hits'|'docs';
	/* A direct CQL query string, or an array of simple search parameters. This value MUST be present if operation === 'hits' */
	pattern: string|PropertyField[]|null;
	/* raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array' */
	within: string|null;
	/* how many hits/docs, or what percentage to sample */
	sampleSize: string;
	/* meaning of sampleSize */
	sampleMode: 'percentage'|'count';
	/* seed for the random sampling */
	sampleSeed: string|null;
	/* Which page to request, does not necessarily have to be a whole number.  Used to calculate 'number' and 'first' */
	page: number;
	/* How many results to request. Should be a whole number. Used to calculate 'number' and 'first' */
	pageSize: number;
	/* How many tokens/words directly before and after hits to show in the results and exports */
	wordsAroundHit?: number;
	/* Metadata filters as generated by singlepage-form.js, every filter is expected to have a valid value. */
	filters?: FilterField[];
	/* Array of valid group types, will be sent as a comma-separated list. */
	groupBy?: string[];
	/* Get results of a specific group instead of an overview of all groups. groupBy MUST be set when this parameter is set. */
	viewGroup?: string|null;
	/* What fields to sort by. */
	sort?: string;
	/* Is grouping/sorting case-sensitive */
	caseSensitive?: boolean;
};

/** BlackLab query parameters. Is a stricter subset of query parameters blacklab accepts. */
export type BlacklabParameters = {
	/* Number of results to request */
	number: number;
	/* Index of first result to request */
	first: number;
	/* percentage of results to return (0-100), mutually exclusive with 'samplenum' */
	sample?: number;
	/* How many results to return, mutually exclusive with 'sample' */
	samplenum?: number;
	/* Seed from which the samples are generated */
	sampleseed?: number;
	/* Context size, may be limited by blacklab */
	wordsaroundhit?: number;
	filter?: string;
	group?: string;
	/* CQL query */
	patt?: string;
	sort?: string;
	/* Also return results within this specific group (only when 'group' specified) */
	viewgroup?: string;
};

declare const BLS_URL: string;

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
function getPatternString(pattern?: string|PropertyField[]|null, within?: string|null): string|undefined {
	if (pattern == null) {
		return undefined;
	}

	if (typeof pattern === 'string') {
		return pattern;
	}

	if (pattern.length === 0) {
		return undefined;
	}

	// First split the properties into individual words and pair them
	const tokens = [] as Array<{[key: string]: string}>;
	$.each(pattern, function(propIndex, propertyField) {
		if (propertyField.value.length > 0) { // skip empty fields
			const words = propertyField.value.split(/\s+/);
			for (let i = 0; i < words.length; i++) {
				if (!tokens[i]) {
					tokens[i] = {};
				}

				tokens[i][propertyField.name] = (propertyField.case ? '(?-i)' : '') + makeWildcardRegex(words[i]);
			}
		}
	});

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

	if (tokenStrings.length > 0 && within) {
		tokenStrings.push(' within ', '<'+ within+'/>');
	}

	return tokenStrings.join('');
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
function getFilterString(filterArr?: FilterField[]): string|undefined {
	if (filterArr == null || filterArr.length === 0) {
		return undefined;
	}

	const filterStrings = [] as string[];
	for (const element of filterArr) {
		if (!element.values.length) {
			continue;
		}

		if (filterStrings.length) {
			filterStrings.push(' AND ');
		}

		if (element.filterType === 'range') {
			filterStrings.push(element.name, ':', '[', element.values[0], ' TO ', element.values[1], ']');
		} else if (element.filterType === 'select') {
			// Surround each individual value with quotes, and surround the total with brackets
			filterStrings.push(element.name, ':', '("', element.values.join('" "'), '")');
		} else {
			// Do the quoting thing
			const resultParts = [] as string[];

			$.each(element.values, function(index, value) {
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
							const words = part.split(/\s+/);
							resultParts.push(' "');
							resultParts.push(words.join('" "'));
							resultParts.push('" ');
						}
					}
					inQuotes = !inQuotes;
				}
			});

			filterStrings.push(element.name, ':', '(' + resultParts.join('').trim(), ')');
		}
	}

	return filterStrings.join('');
}

/**
 * Central handler for updating the totals display
 */
const totalsCounter = (function() {
	// Parameters used in the next update request
	let blsParam: null|BlacklabParameters;
	let operation: null|'hits'|'docs';
	let data;

	// Handles to the current request/scheduled request
	let timeoutHandle: number|null = null;
	let totalRequest: null|ReturnType<typeof $.ajax> = null;

	function scheduleRequest() {
		// Don't request an actual window
		// But keep window size intact in blsParam, we need it to calculate number of pages.
		const url = new URI(BLS_URL).segment(operation!).addSearch($.extend({}, blsParam, {number:0})).toString();

		totalRequest = $.ajax({
			url,
			dataType: 'json',
			cache: false,
			success (responseData) {
				data = responseData;
				updateTotalsDisplay();
				if (data.summary.stillCounting) {
					timeoutHandle = setTimeout(scheduleRequest, 1000);
				} else {
					timeoutHandle = null;
				}
			},
			error () {
				timeoutHandle = null;
				$('#totalsSpinner').hide();
				$('#totalsReportText').text('Network Error');
			},
			complete () {
				totalRequest = null;
			}
		});
	}

	function cancelRequest() {
		if (timeoutHandle != null) {
			clearTimeout(timeoutHandle);
			timeoutHandle = null;
		}
		if (totalRequest != null) {
			totalRequest.abort();
			totalRequest = null;
		}

		$('#totalsReport').hide();
	}

	function updateTotalsDisplay() {
		let type;
		let total;

		if (data.summary.numberOfGroups != null) {
			type = 'groups';
			total = data.summary.numberOfGroups;
		} else if (data.hits != null) {
			type = 'hits';
			total = data.summary.numberOfHits;
		} else if (data.docs != null) {
			type = 'docs';
			total = data.summary.numberOfDocs;
		}

		const totalPages = Math.ceil(total / blsParam!.number);

		const optEllipsis = data.summary.stillCounting ? '...' : '';
		$('#totalsReport').show();
		$('#totalsReportText').html(
			'Total ' + type + ': ' + total + optEllipsis + '<br>' +
			'Total pages: ' + totalPages + optEllipsis
		);

		$('#totalsLimitedWarning').toggle(!!(data.summary.stillCounting === false && data.summary.stoppedCountingHits));
		$('#totalsSpinner').toggle(data.summary.stillCounting);
	}

	return {
		/**
		 * Cancel any pending updates from previous requests,
		 * then immediately update the totals display with the results so far.
		 * Starts a background counter that continues updating the display until all results have been counted.
		 *
		 * @param searchResult - the data returned from blacklab-server with the initial request
		 * @param searchParam - The final (processed) blacklab search parameters.
		 * @param op - The search operation, must not be 'hits' if no pattern supplied.
		 */
		start (searchResult, searchParam: BlacklabParameters, op: 'hits'|'docs') {
			cancelRequest();

			data = searchResult;
			operation = op;
			blsParam = searchParam;

			updateTotalsDisplay();
			if (data.summary.stillCounting) {
				scheduleRequest();
			}
		},
		stop: cancelRequest,
	};
})();

let inflightRequest: null|ReturnType<typeof $.ajax> = null;

/**
 * Translate SearchParameters to blacklab-server search parameters and perform a search.
 *
 * @param {SearchParameters} param - Parameters, these must be in a valid configuration.
 * @param {BLSSuccess} successFunc
 * @param {BLSError} errorFunc
 */
export function search(param, successFunc, errorFunc) {
	const operation = param.operation;
	const blsParam = getBlsParam(param);

	debugLog(blsParam);

	inflightRequest = $.ajax({
		url: new URI(BLS_URL).segment(operation).toString(),
		method: 'POST',
		data: blsParam,
		dataType: 'json',
		cache: false,
		success (data) {
			debugLog(data);

			// only start when we get the first bit of data back
			// or we would fire off two nearly identical requests for nothing
			totalsCounter.start(data, blsParam, operation);

			if (typeof successFunc === 'function') {
				successFunc(data);
			}
		},
		error () {
			debugLog('Request failed: ', arguments);

			if (typeof errorFunc === 'function') {
				errorFunc.apply(undefined, arguments);
			}
		},
		complete () {
			inflightRequest = null;
		}
	});
}

export function cancelSearch() {
	if (inflightRequest != null) {
		inflightRequest.abort();
		inflightRequest = null;
	}
	totalsCounter.stop();
}

/** Translate SearchParameters to blacklab-server parameters. */
export function getBlsParam(param: SearchParameters): BlacklabParameters {
	return {
		// these are always present
		number: param.pageSize,
		first: param.page * param.pageSize,

		sample: (param.sampleMode === 'percentage' && param.sampleSize) ? parseFloat(param.sampleSize) || undefined : undefined,
		samplenum: (param.sampleMode === 'count' && param.sampleSize) ? parseInt(param.sampleSize, 10) || undefined : undefined,
		sampleseed: (param.sampleSeed != null && param.sampleMode && param.sampleSize) ? parseInt(param.sampleSeed, 10) || undefined : undefined,

		// don't let in any NaN or negatives, clamp negatives to 0, which are then replaced by undefined
		wordsaroundhit: param.wordsAroundHit ? Math.max(0, parseInt(param.wordsAroundHit as any /*todo verify*/, 10)) || undefined : undefined,

		// these are either undefined or valid (meaning no empty strings/arrays)
		filter: getFilterString(param.filters),
		group: (param.groupBy || []).map(function(group) { return group + (param.caseSensitive ? ':s' : ':i'); }).join(',') || undefined,
		patt: getPatternString(param.pattern),

		sort: param.sort || undefined,
		viewgroup: param.viewGroup || undefined
	};
}

/** Transform BlackLabParameters into SearchParamers (where supported, blacklab server supports more options than the frontend in some options, so not all options may be mapped cleanly) */
export function getPageParam(blsParam: BlacklabParameters): SearchParameters|null {
	const pageParams: any = {};
	if (blsParam == null || $.isEmptyObject(blsParam)) {
		return null;
	}

	pageParams.operation        = blsParam.patt ? 'hits' : 'docs';
	pageParams.sampleSize       = blsParam.sample != null ? blsParam.sample : blsParam.samplenum;
	pageParams.sampleMode       = blsParam.sample != null ? 'percentage' : blsParam.samplenum != null ? 'count' : undefined;
	pageParams.sampleSeed       = blsParam.sampleseed;
	pageParams.wordsAroundHit   = blsParam.wordsaroundhit || undefined;
	pageParams.page             = blsParam.number != null ? Math.floor((blsParam.first || 0) / blsParam.number) : undefined;
	pageParams.pageSize         = blsParam.number || undefined;
	pageParams.groupBy          = blsParam.group ? blsParam.group.split(',').map(function(group) { return group.replace(/:[si]$/, ''); }) : undefined;
	pageParams.viewGroup        = blsParam.viewgroup;
	pageParams.sort             = blsParam.sort;
	pageParams.caseSensitive    = blsParam.group && blsParam.group.split(',').every(function(group) { return group.endsWith(':s'); }) || undefined;

	// Parse the FilterFields from the lucene query, this is a bit involved.
	// TODO factor into module and add tests.
	try {
		pageParams.filters = parseLucene(blsParam.filter);
	} catch (error) {debugLog('Could not parse lucene query', blsParam.filter);}

	/**
	 * Attempt to parse the cql-query into an array of PropertyFields as used by the simple search tab.
	 * This only works for the most simple of queries.
	 * Essentially do the inverse of getPatternString.
	 *
	 * Also sets the pageParams.within, since it's encoded in the cql query.
	 *
	 * If parsing fails, or the query is too complex, we just return the raw query, it can still be displayed/used elsewhere.
	 */
	pageParams.pattern = (function() {
		function isCase(value) { return value.startsWith('(?-i)') || value.startsWith('(?c)'); }
		function stripCase(value) { return value.substr(value.startsWith('(?-i)') ? 5 : 4); }

		if (!blsParam.patt) {
			return null;
		}

		try {
			const result = parseCql(blsParam.patt);
			pageParams.within = result.within;

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
			 *
			 * @type Object.<string, Array.<String>>
			 */
			const attributeValues = {};

			for (let i = 0; i < result.tokens.length; ++i) {
				/** @type {Token} */
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
			const propertyFields: PropertyField[] = [];
			$.each(attributeValues, function(attrName, attrValues: string[]) {
				const caseSensitive = attrValues.every(isCase);
				if (caseSensitive) {
					attrValues = attrValues.map(stripCase);
				}

				propertyFields.push({
					name: attrName,
					case: caseSensitive,
					value: makeRegexWildcard(attrValues.join(' '))
				});
			});

			return propertyFields;
		} catch (error) {
			debugLog('Could not parse cql query', blsParam.patt);
			pageParams.within = null; // couldn't parse
			return blsParam.patt; // just pass on the cql-query, we can't parse it, or it's too complex
		}
	})();

	return pageParams;
}

/**
 * Get a human-readable summary of the most important search parameters
 * Arguments must be equal to the same members of the SearchParameters object
 *
 * @param {(string | Array.<PropertyField>)} pattern - A direct CQL query string, or an array of simple search paremeters. This value MUST be present if operation === 'hits'
 * @param {string} within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
 * @param {Array.<FilterField>} filters - Metadata filters as generated by singlepage-form.js, every filter is expected to have a valid value.
 */
export function getQuerySummary(pattern: string|PropertyField[]|undefined, within: string|null, filters: FilterField[]|null|undefined) {
	const queryString = getPatternString(pattern, within);
	const metadataString = (filters || []).filter(f => f.values.length > 0).map(filter => {
		return filter.name + ' = [' +
			(filter.filterType === 'range'
				? filter.values[0] + ' to ' + filter.values[1]
				: filter.values.join(', '))
				+ ']';
	}).join(', ');

	let ret = '';
	if (queryString) {
		ret += '"' + queryString + '"' + ' within ';
	}
	if (metadataString) {
		ret += 'documents where ' + metadataString;
	} else {
		ret += 'all documents';
	}

	return ret;
}
