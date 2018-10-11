import $ from 'jquery';
import URI from 'urijs';

import {getState, get} from '@/store';
import {makeWildcardRegex} from '@/utils';
import {debugLog} from '@/utils/debug';
import * as BLTypes from '@/types/blacklabtypes';

/**
 * Converts page state into a query for blacklab-server and executes it.
 * Also handles getting data such as longer snippets, concordances, etc.
 */

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
		return pattern || undefined; // coerce empty to undef
	}

	// First split the properties into individual words and pair them
	const tokens = [] as Array<{[key: string]: string}>;
	for (const field of Object.values(pattern.annotationValues)) {
		if (field.value.length === 0) {
			continue;
		}

		const words = field.value.split(/\s+/);
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

// TODO update documentation
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
export function getFilterString(params: RootState['form']['submittedParameters']): string|undefined {
	if (params == null || !params.filters.length) {
		return undefined;
	}

	const filterStrings = [] as string[];
	for (const filter of params.filters) {
		if (!filter.values.length) {
			continue;
		}

		if (filterStrings.length) {
			filterStrings.push(' AND ');
		}

		if (filter.filterType === 'range') {
			filterStrings.push(filter.id, ':', '[', filter.values[0], ' TO ', filter.values[1], ']');
		} else if (filter.filterType === 'select') {
			// Surround each individual value with quotes, and surround the total with brackets
			filterStrings.push(filter.id, ':', '("', filter.values.join('" "'), '")');
		} else {
			// Do the quoting thing
			const resultParts = [] as string[];

			$.each(filter.values, function(index, value) {
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

			filterStrings.push(filter.id, ':', '(' + resultParts.join('').trim(), ')');
		}
	}

	return filterStrings.join('') || undefined;
}

/**
 * Central handler for updating the totals display
 */
const totalsCounter = (function() {
	// Parameters used in the next update request
	let blsParam: null|BlacklabParameters;
	let operation: null|'hits'|'docs';
	let data: BLTypes.BLSearchResult;

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

		if (BLTypes.isGroups(data)) {
			type = 'groups';
			total = data.summary.numberOfGroups;
		} else if (BLTypes.isHitResults(data)) {
			type = 'hits';
			total = data.summary.numberOfHits;
		} else {
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
		start (searchResult: BLTypes.BLSearchResult, searchParam: BlacklabParameters, op: 'hits'|'docs') {
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
 * @param operation whether to request hits or documents
 * @param param - Parameters, these must be in a valid configuration.
 * @param successFunc
 * @param errorFunc
 */
export function search(operation: 'hits'|'docs', param: BlacklabParameters, successFunc?: (data: BLTypes.BLSearchResult) => void, errorFunc?: JQuery.Ajax.ErrorCallback<any>) {
	debugLog('starting search', operation, param);

	inflightRequest = $.ajax({
		url: new URI(BLS_URL).segment(operation).toString(),
		method: 'POST',
		data: param,
		dataType: 'json',
		cache: false,
		success (data) {
			debugLog('search results', data);

			// only start when we get the first bit of data back
			// or we would fire off two nearly identical requests for nothing
			totalsCounter.start(data, param, operation);

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

export function getBlsParamFromState(): BlacklabParameters {
	const state = getState();

	const viewProps = get.viewedResultsSettings();
	if (viewProps == null) {
		throw new Error('Cannot generate blacklab parameters without knowing hits or docs');
	}

	const submittedParameters = state.form.submittedParameters;
	if (submittedParameters == null) {
		// Realistically we can... because we can use the current state of the ui
		// but this should never happen before the form is submitted, or after it has been cleared
		throw new Error('Cannot generate blacklab parameters before search form has been submitted');
	}

	return {
		filter: getFilterString(submittedParameters),
		first: state.settings.pageSize * viewProps.page,
		group: viewProps.groupBy.map(g => g + (viewProps.caseSensitive ? ':s':':i')).join(',') || undefined,
		// group: viewProps.groupBy.join(',') || undefined,
		number: state.settings.pageSize,
		patt: submittedParameters.pattern||undefined,

		sample: (state.settings.sampleMode === 'percentage' && state.settings.sampleSize) ? state.settings.sampleSize /* can't be null after check */ : undefined,
		samplenum: (state.settings.sampleMode === 'count' && state.settings.sampleSize) ? state.settings.sampleSize : undefined,
		sampleseed: (state.settings.sampleSeed != null && state.settings.sampleMode && state.settings.sampleSize) ? state.settings.sampleSeed : undefined,

		sort: viewProps.sort != null ? viewProps.sort : undefined,
		viewgroup: viewProps.viewGroup != null ? viewProps.viewGroup : undefined,
		wordsaroundhit: state.settings.wordsAroundHit != null ? state.settings.wordsAroundHit : undefined,
	};
}

import {RootState} from '@/store';

/**
 * Get a human-readable summary of the most important search parameters
 * Arguments must be equal to the same members of the SearchParameters object
 *
 * @param pattern - A direct CQL query string, or an array of simple search paremeters. This value MUST be present if operation === 'hits'
 * @param within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
 * @param filters - Metadata filters as generated by singlepage-form.js, every filter is expected to have a valid value.
 */
export function getQuerySummary(params: RootState['form']['submittedParameters']) {
	if (params == null) {
		return 'all documents';
	}

	const queryString = params.pattern;
	const metadataString = params.filters.map(({id, filterType, values}) =>
		`${id} = [${filterType==='range'?`${values[0]} to ${values[1]}`:values.join(', ')}]`).join(', ');

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
