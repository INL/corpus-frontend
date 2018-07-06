/* global URI, querybuilder */

var SINGLEPAGE = SINGLEPAGE || {};

SINGLEPAGE.DEBUG = false;

SINGLEPAGE.CORE = (function () {
	'use strict';

	$(document).ready(function () {
		SINGLEPAGE.FORM.init();
		SINGLEPAGE.INTERFACE.init();

		if (window.localStorage) {
			$('input[data-persistent][id != ""]').each(function(i, elem) {
				var $this = $(elem);
				var key = 'input_' + $this.attr('id');
				$this.on('change', function() {
					var curVal = $this.is(':checkbox') ? $this.is(':checked') : $this.val();
					window.localStorage.setItem(key, curVal);
				});

				var storedVal = window.localStorage.getItem(key);
				if (storedVal != null)
					$this.is(':checkbox') ? $this.attr('checked', storedVal.toLowerCase() === 'true') : $this.val(storedVal);
				$this.trigger('change'); // run handler once, init localstorage if required
			});
		}

		// Init the querybuilder with the supported attributes/properties
		var $queryBuilder = $('#querybuilder'); // container
		var queryBuilderInstance = querybuilder.createQueryBuilder($queryBuilder, {
			attribute: {
				view: {
					// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
					attributes: $.map(SINGLEPAGE.INDEX.complexFields, function (complexField, complexFieldName) {
						return $.map(complexField.properties, function(property, propertyId) {
							if (property.isInternal)
								return null; // Don't show internal fields in the queryBuilder; leave this out of the list.

							// Transform the supported values to the querybuilder format
							return {
								attribute: propertyId,
								label: property.displayName || propertyId,
								caseSensitive: (property.sensitivity === 'SENSITIVE_AND_INSENSITIVE')
							};
						});
					}),
				}
			}
		});

		// register click handlers in the main search form (data irrespective or currently viewed tab)
		// Parsing and validation of the values is performed in singlepage-bls when the search is executed
		// and in toPageState when the values are written from the query
		$('#resultsPerPage').on('change', function () {
			SINGLEPAGE.INTERFACE.setParameters({
				pageSize: $(this).selectpicker('val')
			});
		});
		$('#sampleMode').on('change', function () {
			SINGLEPAGE.INTERFACE.setParameters({
				sampleMode: $(this).selectpicker('val') 
			});
		});
		$('#sampleSize').on('change', function () {
			SINGLEPAGE.INTERFACE.setParameters({
				sampleSize: $(this).val(), 
				sampleMode: $('#sampleMode').selectpicker('val') // in case it hasn't been initialized
			});
		});
		$('#sampleSeed').on('change', function () {
			SINGLEPAGE.INTERFACE.setParameters({
				sampleSeed: $(this).val() 
			});
		});
		$('#wordsAroundHit').on('change', function() {
			SINGLEPAGE.INTERFACE.setParameters({
				wordsAroundHit: $(this).val() // validation/parsing performed in singlepage-bls 
			});
		});

		// Prevent enter from submitting the form and initiating a search, 
		// these settings should only update existing searches
		$('#sampleSize, #sampleSeed, #wordsAroundHit').on('keypress', function(event) {
			if (event.keyCode === 13) {
				$(this).trigger('change');
				event.preventDefault();
			}
		});

		// Rescale the querybuilder container when it's shown
		$('a.querytype[href="#advanced"]').on('shown.bs.tab hide.bs.tab', function () {
			$('#searchContainer').toggleClass('col-md-6');
		});

		// Attempt to parse the query from the cql editor into the querybuilder
		// when the user asks to
		$('#parseQuery').on('click', function() {
			var pattern = $('#querybox').val();
			if (populateQueryBuilder(pattern))
				$('#searchTabs a[href="#advanced"]').tab('show') && $('#parseQueryError').hide();
			else {
				$('#parseQueryError').show();
				$('#querybox').val(pattern);
			}
		});

		// And copy over the generated query to the manual field when changes happen
		var $queryBox = $('#querybox'); //cql textfield
		$queryBuilder.on('cql:modified', function () {
			$queryBox.val(queryBuilderInstance.getCql());
		});

		// now restore the page state from the used url
		// This will automatically start a search if the settings indicate it
		var searchSettings = fromPageUrl();
		if (searchSettings != null) {
			toPageState(searchSettings);
		}
	});


	// Restore page when using back/forward
	window.addEventListener('popstate', function() {
		var searchSettings = fromPageUrl();
		toPageState(searchSettings || {});
	});

	/**
	 * Decode the current page url in the format of /<contextRoot>/<corpus>/search/[hits|docs][/]?query=...
	 * into a SearchParameters object
	 *
	 * @param {string} url - full page url, the querystring (if present) should encode a BlackLabParameters object
	 * @returns {SearchParameters} object containing the decoded and translated parameters, or null if no parameters were found
	 */
	function fromPageUrl() {
		var uri = new URI();
		var paths = uri.segmentCoded();

		// operation is (usually) contained in the path, the other parameters are contained in the query parameters
		var operation = paths[paths.lastIndexOf('search') + 1];

		var blsParam = new URI().search(true);
		if ($.isEmptyObject(blsParam))
			return null;

		var pageParam = SINGLEPAGE.BLS.getPageParam(blsParam);
		if (operation)
			pageParam.operation = operation;

		return pageParam;
	}

	/**
	 * Encodes search parameters into a page url as understood by fromPageUrl().
	 * N.B. we assume we're mounted under /<contextRoot>/<corpus>/search/[hits|docs][/]?query=...
	 * The contextRoot can be anything, even multiple segments (due to reverse proxy, different WAR deploy path, etc)
	 * But we assume the /search/ part still exists.
	 *
	 * Removes any empty strings, arrays, null, undefineds prior to conversion, to shorten the resulting query string.
	 *
	 * @param {SearchParameters} searchParams the search parameters
	 * @returns the query string, beginning with ?, or an empty string when no searchParams with a proper value
	 */
	function toPageUrl(searchParams) {
		var operation = searchParams && searchParams.operation; // store, as blsParams doesn't contain it: 'hits' or 'docs' or undefined
		searchParams = SINGLEPAGE.BLS.getBlsParam(searchParams);

		var uri = new URI();
		var paths = uri.segmentCoded();
		var basePath = paths.slice(0, paths.lastIndexOf('search')+1);
		// basePath now contains our url path, up to and including /search/

		// If we're not searching, return a bare url pointing to /search/
		if (searchParams == null) {
			return uri.directory(basePath).search(null).toString();
		}

		// remove null, undefined, empty strings and empty arrays from our query params
		var modifiedParams = {};
		$.each(searchParams, function(key, value) {
			if (value == null)
				return true;
			if (value.length === 0)
				return true;
			modifiedParams[key] = value;
		});

		// Append the operation, query params, etc, and return.
		return uri.segmentCoded(basePath).segmentCoded(operation).search(modifiedParams).toString();
	}

	/**
	 * Attempt to parse the query pattern and update the state of the query builder
	 * to match it as much as possible.
	 *
	 * @param {string} pattern - cql query
	 * @returns True or false indicating success or failure respectively
	 */
	function populateQueryBuilder(pattern) {
		if (!pattern)
			return false;

		try {
			var parsedCql = SINGLEPAGE.CQLPARSER.parse(pattern);
			var tokens = parsedCql.tokens;
			var within = parsedCql.within;
			if (tokens === null) {
				return false;
			}

			var queryBuilder = $('#querybuilder').data('builder');
			queryBuilder.reset();
			if (tokens.length > 0) {
				// only clear the querybuilder when we're putting something back in
				$.each(queryBuilder.getTokens(), function(i, e) {
					e.element.remove();
				});
			}
			if (within)
				queryBuilder.set('within', within);

			// TODO: try and repopulate the "simple" tab

			$.each(tokens, function(index, token) {
				var tokenInstance = queryBuilder.createToken();

				//clean the root group of all contents
				$.each(tokenInstance.rootAttributeGroup.getAttributes(), function(i, el) {
					el.element.remove();
				});

				$.each(tokenInstance.rootAttributeGroup.getAttributeGroups(), function(i, el) {
					el.element.remove();
				});

				tokenInstance.set('beginOfSentence', !!token.leadingXmlTag && token.leadingXmlTag.name === 's');
				tokenInstance.set('endOfSentence', !!token.trailingXmlTag && token.trailingXmlTag.name === 's');
				tokenInstance.set('optional', token.optional || false);

				if (token.repeats) {
					tokenInstance.set('minRepeats', token.repeats.min);
					tokenInstance.set('maxRepeats', token.repeats.max);
				}

				function doOp(op, parentAttributeGroup, level) {
					if (op == null)
						return;

					if (op.type === 'binaryOp') {
						var label = op.operator === '&' ? 'AND' : 'OR'; // TODO get label internally in builder
						if (op.operator != parentAttributeGroup.operator) {

							if (level === 0) {
								parentAttributeGroup.operator = op.operator;
								parentAttributeGroup.label = label;
							} else if (parentAttributeGroup.operator !== op.operator) {
								parentAttributeGroup = parentAttributeGroup.createAttributeGroup(op.operator, label);
							}
						}

						//inverse order, since new elements are inserted at top..
						doOp(op.right, parentAttributeGroup, level + 1);
						doOp(op.left, parentAttributeGroup, level + 1);
					} else if (op.type === 'attribute') {

						var attributeInstance = parentAttributeGroup.createAttribute();

						// case flag is always at the front, so check for that before checking
						// for starts with/ends with flags
						if (op.value.indexOf('(?-i)') === 0) {
							attributeInstance.set('case', true, op.name);
							op.value = op.value.substr(5);
						} else if (op.value.indexOf('(?c)') === 0) {
							attributeInstance.set('case', true, op.name);
							op.value = op.value.substr(4);
						}

						if (op.operator === '=' && op.value.length >= 2 && op.value.indexOf('|') === -1) {
							if (op.value.indexOf('.*') === 0) {
								op.operator = 'ends with';
								op.value = op.value.substr(2);
							}
							else if (op.value.indexOf('.*') === op.value.length -2) {
								op.operator = 'starts with';
								op.value = op.value.substr(0, op.value.length-2);
							}
						}


						attributeInstance.set('operator', op.operator);
						attributeInstance.set('type', op.name);

						attributeInstance.set('val', op.value);
					}
				}

				doOp(token.expression, tokenInstance.rootAttributeGroup, 0);
				tokenInstance.element.trigger('cql:modified');
			});
		} catch (e) {
			// couldn't decode query
			if (SINGLEPAGE.DEBUG) {
				console.log('Cql parser could not decode query pattern');
				console.log(e);
				console.log(pattern);
			}
			return false;
		}

		return true;
	}

	/**
	 * Completely resets all form and results information and controls, then repopulates the page with the parameters.
	 * Also initiates a search if the parameters contain a valid search. (the 'operation' is valid).
	 *
	 * NOTE: when called with a {} parameter, the entire page will be cleared.
	 *
	 * @param {any} searchParams
	 */
	function toPageState(searchParams) {
		// reset and repopulate the main form
		SINGLEPAGE.FORM.reset();
		$('#querybuilder').data('builder').reset();
		$('#querybox').val(undefined);

		if (searchParams.pattern) {
			// In the case of an array as search pattern,  it contains the basic/simple search parameters
			if (searchParams.pattern.constructor === Array) {
				$.each(searchParams.pattern, function (index, element) {
					SINGLEPAGE.FORM.setPropertyValues(element);
				});
			} else {
				// We have a raw cql query string, attempt to parse it using the querybuilder,
				// otherwise fall back to the raw cql view
				if (populateQueryBuilder(searchParams.pattern)) {
					$('#searchTabs a[href="#advanced"]').tab('show');
				} else  {
					$('#querybuilder').data('builder').reset(); // clear potential half-parsed state
					$('#searchTabs a[href="#query"]').tab('show');
					// only set after attempting to populate querybuilder, 
					// or querybuilder will overwrite the value immediately when we populate it
					// (this is usually not a problem, but it is when the query is malformed or too 
					// advanced for the builder to use - a half parsed query could then be written)
					$('#querybox').val(searchParams.pattern);
				}
			}
		}

		$.each(searchParams.filters, function (index, element) {
			SINGLEPAGE.FORM.setFilterValues(element.name, element.values);
		});

		SINGLEPAGE.FORM.setWithin(searchParams.within);

		// Restore the results per page, sample info, etc
		$('#resultsPerPage').selectpicker('val', [searchParams.pageSize || 50]);
		$('#sampleSize').val(searchParams.sampleSize || '');
		$('#sampleMode').selectpicker('val', [searchParams.sampleMode || 'percentage']);
		$('#sampleSeed').val(searchParams.sampleSeed || '');
		$('#wordsAroundHit').val(searchParams.wordsAroundHit || '');

		// Clear the results area, then actually run the search
		SINGLEPAGE.INTERFACE.reset();
		SINGLEPAGE.INTERFACE.setParameters(searchParams);

		// Select a tab to display if there is enough information to perform a search
		// The tab will then auto-refresh and display results.
		if (searchParams.operation === 'hits') {
			$('#resultTabs a[href="#tabHits"]').tab('show');
		} else if (searchParams.operation === 'docs') {
			$('#resultTabs a[href="#tabDocs"]').tab('show');
		}
	}

	return {
		// Called when form is submitted
		searchSubmit: function() {
			var pattern;
			var within = null; // explicitly set to null to clear any previous value if queryType != simple

			// Get the correct pattern based on selected tab
			var queryType = $('#searchTabs li.active .querytype').attr('href');
			if (queryType === '#simple') {
				pattern = SINGLEPAGE.FORM.getActiveProperties();
				within = SINGLEPAGE.FORM.getWithin();
			} else if (queryType === '#advanced') {
				pattern = $('#querybuilder').data('builder').getCql();
			} else {
				pattern = $('#querybox').val();
			}

			SINGLEPAGE.INTERFACE.setParameters({
				page: 0,
				viewGroup: null, // reset, as we might be looking at a detailed group currently, and the new search should not display within a specific group
				pageSize: $('#resultsPerPage').selectpicker('val'),
				pattern: pattern,
				within: within,
				filters: SINGLEPAGE.FORM.getActiveFilters(),
				// Other parameters are automatically updated on interaction and thus always up-to-date
			}, true);

			// Setting parameters refreshes the shown results (if a result tab is opened),
			// but when there are no results shown, activate one of the tabs manually (this also triggers a refresh of the results in that tab)
			if (!$('#resultTabs .active').length) {
				if (pattern) {
					$('#resultTabs a[href="#tabHits"]').tab('show');
				} else {
					$('#resultTabs a[href="#tabDocs"]').tab('show');
				}
			}

			$('html, body').animate({
				scrollTop: $('#searchFormDivHeader').offset().top - 75 // navbar
			}, 500);

			// May be used as click handler, so prevent event propagation
			return false;
		},

		/**
		 * Callback from when a search is executed (not neccesarily by the user, could also just be pagination and the like)
		 * @param {SearchParameters} searchParams
		 */
		onSearchUpdated: function(searchParams) {
			// Only push new url if different
			// Why? Because when the user goes back say, 10 pages, we reinit the page and do a search with the restored parameters
			// this search would push a new history entry, popping the next 10 pages off the stack, which the url is the same because we just entered the page.
			// So don't do that.
			var newUrl = toPageUrl(searchParams);
			var currentUrl = new URI().toString();
			if (newUrl !== currentUrl)
				history.pushState(null, null, newUrl);
		},

		// Called to reset search form and results
		resetPage: function() {
			history.pushState(null, null, '?');
			toPageState({});
			SINGLEPAGE.BLS.cancelSearch();
			return false;
		},
	};
})();
