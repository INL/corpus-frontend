/* global BLS_URL, URI */

var SINGLEPAGE = SINGLEPAGE || {};

/**
 * Converts search parameters into a query for blacklab-server and executes it.
 * Also handles getting data such as longer snippets, concordances, etc.
 */
SINGLEPAGE.BLS = (function () {

	"use strict";
	
	function makeWildcardRegex(original) {
		return original
			.replace(/([\^$\-\\.(){}[\]+])/g, "\\$1") // add slashes for regex characters
			.replace(/\*/g, ".*") // * -> .*
			.replace(/\?/g, "."); // ? -> .
	}

	function makeRegexWildcard(original) {
		return original
			.replace(/\\([\^$\-\\(){}[\]+])/g, "$1") // remove most slashes
			.replace(/\\\./g, "_ESC_PERIOD_") // escape \.
			.replace(/\.\*/g, "*") // restore *
			.replace(/\./g, "?") // restore ?
			.replace("_ESC_PERIOD_", ".") // unescape \. to .
		;
	}

	/**
	 * Converts an array of PropertyFields to a cql token string.
	 * If wordprop is a string already, it is returned as-is.
	 * Every PropertyField value is split on whitespace, and every word is mapped to a token with the same index.
	 * I.E. lemma="multiple words" is converted to [lemma="multiple"][lemma="words"]
	 * Values are converted from wildcard to regex, and case sensitivity flags are inserted where case-sensitive searching is specified.
	 * @param {(string | Array.<PropertyField>)} wordProp 
	 * @returns {String} The formatted string
	 */
	function getPatternString(wordProp) {
		if (wordProp == null)
			return undefined;

		if (typeof wordProp === 'string')
			return wordProp;
		
		// First split the properties into individual words and pair them 
		var tokens = [];
		$.each(wordProp, function (propIndex, propertyField) {
			var words = propertyField.value.split(/\s+/);
			for (var i = 0; i < words.length; i++) {
				if (!tokens[i])
					tokens[i] = {};

				tokens[i][propertyField.name] = (propertyField["case"] ? "(?c)" : "") + makeWildcardRegex(words[i]);
			}
		});

		var tokenStrings = [];		
		$.each(tokens, function(index, value) {
			
			// push all attributes in this token
			var attributesStrings = [];
			$.each(value, function (key, value) {
				attributesStrings.push(key + "=" + '"' + value + '"');
			});

			tokenStrings.push("[", attributesStrings.join(" & "), "]");
		});
		
		return tokenStrings.join("");
	}

	function getFilterString(filterArr) {
		
		if (filterArr == null || filterArr.length === 0)
			return undefined;
		
		var filterStrings = [];
		$.each(filterArr, function (index, element) {
			if (element.filterType === "range") {
				filterStrings.push(
					"+", element.name, ":",
					"[", element.values[0], " TO ", element.values[1], "]"
				);
			} else if (element.filterType === "select" || element.filterType === "multiselect") {
				// Surround each individual value with quotes, and surround the total with brackets  
				filterStrings.push(
					"+", element.name, ":",
					'("', element.values.join('" "'), '")'
				);
			} else {
				// Regular input field(s)
				// Preserve all parts surrounded by quotes, and add quotes around any word not within quotes already
				// Effectively transform 
				//	"quoted value" not quoted value
				// into
				// "quoted value" "not" "quoted" "value"

				var resultParts = [];

				$.each(element.values, function (index, value) {
					var quotedParts = value.split(/"/);
					var inQuotes = false;
					for (var i = 0; i < quotedParts.length; i++) {
						var part = quotedParts[i];
						if (inQuotes) {
							// Inside quotes. Add literally.
							resultParts.push(" \"");
							resultParts.push(part);
							resultParts.push("\"");
						} else {
							// Outside quotes. Surround each word with quotes.
							part = part.trim();
							if (part.length > 0) {
								var words = part.split(/\s+/);
								resultParts.push(" \"");
								resultParts.push(words.join("\" \""));
								resultParts.push("\" ");
							}
						}
						inQuotes = !inQuotes;
					}
				});

				filterStrings.push(
					"+", element.name, ":",
					"(" + resultParts.join("").trim(), ")"
				);
			}
		});

		return filterStrings.join("");
	}

	/**
	 * Polls blacklab for the number of results in the query and updates the UI.
	 * Continues to poll until all results are known or a new search is executed.
	 * 
	 * @param {any} blsParam - The final (processed) blacklab search parameters.
	 * @param {string} operation - The search operation, must not be 'hits' if no pattern supplied.
	 */
	var countHits = (function(){
		
		var curUrl;
		var curPageSize;

		var running = false;
		
		function run() {
			running = true;
			
			$.ajax({
				url: curUrl,
				dataType: "json",
				cache: false,
				success: function(data) {
					
					updateTotalsDisplay(data);
					if (data.summary.stillCounting) {
						setTimeout(run, 1000);
					} else {
						running = false;
					}
				}
			});
		}
		// TODO accurate group counting
		// No need to update pagination here, happens when page is changed anyway
		function updateTotalsDisplay(data) {
			var type;// = data.hits ? 'hits' : 'docs';
			var total;// = (type === 'hits' ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved);
			
			if (data.summary.numberOfGroups != null) {
				type = "groups";
				total = data.summary.numberOfGroups;
			} else if (data.hits != null) {
				type = "hits";
				total = data.summary.numberOfHitsRetrieved;
			} else if (data.docs != null) {
				type = "docs";
				total = data.summary.numberOfDocsRetrieved;
			}
		
			var totalPages = Math.ceil(total / curPageSize);
			
			var optEllipsis = data.summary.stillCounting ? "..." : "";
			$("#totalsReport").show();
			$("#totalsReportText").html(
				"Total " + type + ": " + total + optEllipsis + "<br>" + 
				"Total pages: " + totalPages + optEllipsis
			);
			if (data.summary.stillCounting) {
				$("#totalsSpinner").show();
			} else {
				$("#totalsSpinner").hide();
			}
		}

		return function(blsParam, operation) {
			// Store the requested page size (to do page number calculation)
			// Then set request page size to 0 so we don't actually retrieve any results
			curPageSize = blsParam.number;
			curUrl = new URI(BLS_URL).segment(operation).addSearch($.extend({},blsParam, {number:0})).toString();

			if (!running) // restart 
				run();
		}
	})();

	return {
		search: function (param, successFunc, errorFunc) {
			var operation = param.operation;
			var blsParam = {
				// these are always present
				number: param.pageSize,
				first: param.page * param.pageSize,
				
				// these are either undefined or valid (meaning no empty strings/arrays)
				filter: getFilterString(param.filters), 
				group: (param.groupBy || []).join(",") || undefined,
				patt: getPatternString(param.pattern),
			
				sort: param.sort || undefined,
				viewgroup: param.viewGroup || undefined
			};
			
			if (SINGLEPAGE.DEBUG) {
				console.log(blsParam);
			}

			// Called to perform the search, update the
			// total count, and call a success function.
			$.ajax({
				url: new URI(BLS_URL).segment(operation).addSearch(blsParam).toString(),
				dataType: "json",
				cache: false,
				success: function(data) {
					if (SINGLEPAGE.DEBUG) {
						console.log(data);
					}

					if (typeof successFunc === "function")
						successFunc(data);
				},
				error: errorFunc
			});

			countHits(blsParam, operation);
		}
	}
})();