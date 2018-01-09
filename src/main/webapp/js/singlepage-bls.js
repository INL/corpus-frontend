/* global BLS_URL, URI */

/**
 * @typedef {Object} SearchParameters
 * 
 * @property {('hits' | 'docs')} operation - The main type of data to request, is transformed to the path of the search url, as in blacklab-server/corpusId/<operation>?parameters
 * @property {(string | Array.<PropertyField>)} [pattern] - A direct CQL query string, or an array of simple search parameters. This value MUST be present if operation === 'hits' 
 * @property {string} within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
 * @property {string} sampleSize - how many hits/docs, or what percentage to sample
 * @property {('percentage' | 'count')} sampleMode - meaning of sampleSize
 * @property {string} sampleSeed - seed for the random sampling
 * @property {number} page - Which page to request, does not necessarily have to be a whole number.  Used to calculate 'number' and 'first'
 * @property {number} pageSize - How many results to request. Should be a whole number. Used to calculate 'number' and 'first'
 * @property {Array.<FilterField>} [filters] - Metadata filters as generated by singlepage-form.js, every filter is expected to have a valid value.
 * @property {Array.<string>} [groupBy] - Array of valid group types, will be sent as a comma-separated list. 
 * @property {string} [viewGroup] - Get results of a specific group instead of an overview of all groups. groupBy MUST be set when this parameter is set.
 * @property {string} [sort] - what fields to sort by.
 */

var SINGLEPAGE = SINGLEPAGE || {};

/**
 * Converts search parameters into a query for blacklab-server and executes it.
 * Also handles getting data such as longer snippets, concordances, etc.
 */
SINGLEPAGE.BLS = (function () {

	'use strict';
	
	function makeWildcardRegex(original) {
		return original
			.replace(/([\^$\-\\.(){}[\]+])/g, '\\$1') // add slashes for regex characters
			.replace(/\*/g, '.*') // * -> .*
			.replace(/\?/g, '.'); // ? -> .
	}

	function makeRegexWildcard(original) {
		return original
			.replace(/\\([\^$\-\\(){}[\]+])/g, '$1') // remove most slashes
			.replace(/\\\./g, '_ESC_PERIOD_') // escape \.
			.replace(/\.\*/g, '*') // restore *
			.replace(/\./g, '?') // restore ?
			.replace('_ESC_PERIOD_', '.') // unescape \. to .
		;
	}

	/**
	 * Converts an array of PropertyFields to a cql token string.
	 * If pattern is a string already, it is returned as-is.
	 * Every PropertyField value is split on whitespace, and every word is mapped to a token with the same index.
	 * I.E. lemma="multiple words" is converted to [lemma="multiple"][lemma="words"]
	 * Values are converted from wildcard to regex, and case sensitivity flags are inserted where case-sensitive searching is specified.
	 * @param {(string | Array.<PropertyField>)} pattern 
	 * @param {string} within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
	 * @returns {String} The formatted string
	 */
	function getPatternString(pattern, within) {
		if (pattern == null)
			return undefined;

		if (typeof pattern === 'string')
			return pattern;
		
		// First split the properties into individual words and pair them 
		var tokens = [];
		$.each(pattern, function (propIndex, propertyField) {
			var words = propertyField.value.split(/\s+/);
			for (var i = 0; i < words.length; i++) {
				if (!tokens[i])
					tokens[i] = {};

				tokens[i][propertyField.name] = (propertyField['case'] ? '(?c)' : '') + makeWildcardRegex(words[i]);
			}
		});

		var tokenStrings = [];		
		$.each(tokens, function(index, value) {
			
			// push all attributes in this token
			var attributesStrings = [];
			$.each(value, function (key, value) {
				if (value) // don't push empty attributes
					attributesStrings.push(key + '=' + '"' + value + '"');
			});

			tokenStrings.push('[', attributesStrings.join(' & '), ']');
		});

		if (within)
			tokenStrings.push(' within ', '<'+ within+'/>');
		
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
	 * 
	 * @param {Array.<FilterField>} [filterArr]
	 * @returns {string} - The converted filters, or undefined if no filters were present.
	 */
	function getFilterString(filterArr) {
		
		if (filterArr == null || filterArr.length === 0)
			return undefined;
		
		var filterStrings = [];
		$.each(filterArr, function (index, element) {
			if (element.filterType === 'range') {
				filterStrings.push(
					'+', element.name, ':',
					'[', element.values[0], ' TO ', element.values[1], ']'
				);
			} else if (element.filterType === 'select' || element.filterType === 'multiselect') {
				// Surround each individual value with quotes, and surround the total with brackets  
				filterStrings.push(
					'+', element.name, ':',
					'("', element.values.join('" "'), '")'
				);
			} else {
				
				// Do the quoting thing
				var resultParts = [];

				$.each(element.values, function (index, value) {
					var quotedParts = value.split(/"/);
					var inQuotes = false;
					for (var i = 0; i < quotedParts.length; i++) {
						var part = quotedParts[i];
						if (inQuotes) {
							// Inside quotes. Add literally.
							resultParts.push(' "');
							resultParts.push(part);
							resultParts.push('"');
						} else {
							// Outside quotes. Surround each word with quotes.
							part = part.trim();
							if (part.length > 0) {
								var words = part.split(/\s+/);
								resultParts.push(' "');
								resultParts.push(words.join('" "'));
								resultParts.push('" ');
							}
						}
						inQuotes = !inQuotes;
					}
				});

				filterStrings.push(
					'+', element.name, ':',
					'(' + resultParts.join('').trim(), ')'
				);
			}
		});

		return filterStrings.join('');
	}

	/**
	 * Central handler for updating the totals display
	 */
	var totalsCounter = (function(){
		// Parameters used in the next update request
		var curUrl;
		var curPageSize;
		
		// Handles to the current request/scheduled request
		var timeoutHandle = null;
		var inflightRequest = null;
		
		function scheduleRequest() {
			inflightRequest = $.ajax({
				url: curUrl,
				dataType: 'json',
				cache: false,
				success: function(data) {
					updateTotalsDisplay(data);
					if (data.summary.stillCounting) {
						timeoutHandle = setTimeout(scheduleRequest, 1000);
					} else {
						timeoutHandle = null;
					}
				},
				fail: function() {
					timeoutHandle = null;
				},
				complete: function() {
					inflightRequest = null;
				}
			});
		}
		
		function cancelRequest() {
			timeoutHandle != null && clearTimeout(timeoutHandle);
			timeoutHandle = null;
			
			inflightRequest != null && inflightRequest.abort();
			inflightRequest = null;
		}
		
		function updateTotalsDisplay(data) {
			var type;
			var total;
			
			if (data.summary.numberOfGroups != null) {
				type = 'groups';
				total = data.summary.numberOfGroups;
			} else if (data.hits != null) {
				type = 'hits';
				total = data.summary.numberOfHitsRetrieved;
			} else if (data.docs != null) {
				type = 'docs';
				total = data.summary.numberOfDocsRetrieved;
			}
		
			var totalPages = Math.ceil(total / curPageSize);
			
			var optEllipsis = data.summary.stillCounting ? '...' : '';
			$('#totalsReport').show();
			$('#totalsReportText').html(
				'Total ' + type + ': ' + total + optEllipsis + '<br>' + 
				'Total pages: ' + totalPages + optEllipsis
			);
			
			$('#totalsSpinner').toggle(data.summary.stillCounting);
		}

		return {
			/**
			 * Cancel any pending updates from previous requests, 
			 * then immediately update the totals display with the results so far.
			 * Starts a background counter that continues updating the display until all results have been counted.
			 * 
			 * @param {any} data - the data returned from blacklab-server with the initial request 
			 * @param {any} blsParam - The final (processed) blacklab search parameters.
			 * @param {string} operation - The search operation, must not be 'hits' if no pattern supplied.
			 */
			start: function(data, blsParam, operation) {
				cancelRequest();
				
				// Store the requested page size (to do page number calculation)
				// Then set request page size to 0 so we don't actually retrieve any results
				curPageSize = blsParam.number;
				curUrl = new URI(BLS_URL).segment(operation).addSearch($.extend({},blsParam, {number:0})).toString();
				updateTotalsDisplay(data);
				
				if (data.summary.stillCounting)
					scheduleRequest();
			},
			
			stop: cancelRequest
		}
	})();

	// Return a closure with some request caching variables
	return (function() {
		var inflightRequest = null;
		
		return {
			/** 
			 * Translate internal parameters to blacklab-server search parameters and perform a search.
			 * 
			 * @param {SearchParameters} param - Parameters, these must be in a valid configuration.
			 * @param {BLSSuccess} successFunc 
			 * @param {BLSError} errorFunc 
			 */
			search: function (param, successFunc, errorFunc) {
				var operation = param.operation;
				var blsParam = {
					// these are always present
					number: param.pageSize,
					first: param.page * param.pageSize,
				
					sample: (param.sampleMode === 'percentage' && param.sampleSize) ? parseFloat(param.sampleSize) || undefined : undefined, //coerce NaN into undef
					samplenum: (param.sampleMode === 'count' && param.sampleSize) ? parseInt(param.sampleSize) || undefined : undefined, // likewise
					sampleseed: (param.sampleSeed != null && param.sampleMode && param.sampleSize) ? parseInt(param.sampleSeed) || undefined : undefined, // likewise

					// these are either undefined or valid (meaning no empty strings/arrays)
					filter: getFilterString(param.filters), 
					group: (param.groupBy || []).join(',') || undefined,
					patt: getPatternString(param.pattern, param.within),
			
					sort: param.sort || undefined,
					viewgroup: param.viewGroup || undefined
				};
			
				if (SINGLEPAGE.DEBUG) {
					console.log(blsParam);
				}

				inflightRequest = $.ajax({
					url: new URI(BLS_URL).segment(operation).addSearch(blsParam).toString(),
					dataType: 'json',
					cache: false,
					success: function(data) {
						if (SINGLEPAGE.DEBUG) {
							console.log(data);
						}
						
						totalsCounter.start(data, blsParam, operation);
						
						if (typeof successFunc === 'function')
							successFunc(data);
					},
					error: function() {
						if (SINGLEPAGE.DEBUG)
							console.log('Request failed: ', arguments);
						
						if (typeof errorFunc === 'function')
							errorFunc.apply(undefined, arguments);
					},
					complete: function() {
						inflightRequest = null;
					}
				});
			},

			cancelSearch: function() {
				inflightRequest != null && inflightRequest.abort();
				inflightRequest = null;
				totalsCounter.stop();
			},

			/**
			 * Get a human-readable summary of the most important search parameters
			 * Arguments must be equal to the same members of the SearchParameters object
			 * 
			 * @param {(string | Array.<PropertyField>)} pattern - A direct CQL query string, or an array of simple search paremeters. This value MUST be present if operation === 'hits' 
			 * @param {string} within - raw token name (i.e. not enclosed in </>) for the within clause (so 'p' for paragraph, 's' for sentence, etc), only used when typeof pattern === 'Array'
			 * @param {Array.<FilterField>} filters - Metadata filters as generated by singlepage-form.js, every filter is expected to have a valid value.
			 */
			getQuerySummary: function(pattern, within, filters) {
				var queryString = getPatternString(pattern, within);
				var metadataString = $.map(filters, function(filter) {
					return filter.name + ' = [' + 
						(filter.filterType === 'range' 
						? filter.values[0] + ' to ' + filter.values[1] 
						: filter.values.join(', ')) 
						+ ']';
				})
				.join(', ');

				var ret = '';
				if (queryString) {
					ret += '"' + queryString + '"' + ' within ';	
				} 
				if (metadataString)
					ret += 'documents where ' + metadataString;
				else 
					ret += 'all documents';
		
				return ret;
			}
		}
	})();
})();
