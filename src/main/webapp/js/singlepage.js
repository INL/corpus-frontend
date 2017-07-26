/* global BLS_URL, URI, querybuilder */

var SINGLEPAGE = SINGLEPAGE || {};

SINGLEPAGE.DEBUG = true;

SINGLEPAGE.CORE = (function () {
	"use strict";

	$(document).ready(function () {
		SINGLEPAGE.FORM.init();
		SINGLEPAGE.INTERFACE.init();
		
		// Rescale the querybuilder container when it's selected
		$('a.querytype[href="#advanced"]').on('shown.bs.tab hide.bs.tab', function () {
			$('#searchContainer').toggleClass('col-md-6');
		});

		// Init the querybuilder with the supported attributes/properties
		$.ajax({
			url: BLS_URL + 'fields/contents',
			dataType: "json",

			success: function (response) {
				// Init the querybuilder
				var $queryBuilder = $('#querybuilder'); // querybuilder container
				var queryBuilderInstance = querybuilder.createQueryBuilder($queryBuilder, {
					attribute: {
						view: {
							attributes: $.map(response.properties, function (value, key) {
								if (value.isInternal)
									return null; // Ignore these fields

								// Transform the supported values to the querybuilder format 
								return {
									attribute: key,
									label: value.displayName || key,
									caseSensitive: (value.sensitivity === "SENSITIVE_AND_INSENSITIVE")
								}
							}),
						}
					}
				});

				// And copy over the generated query to the manual field when changes happen
				var $queryBox = $('#querybox'); //cql textfield
				$queryBuilder.on('cql:modified', function () {
					$queryBox.val(queryBuilderInstance.getCql());
				});
			},
			error: function (jqXHR, textStatus) {
				var $queryBuilder = $('#querybuilder');
				$queryBuilder.text("Could not get supported values for querybuilder: " + textStatus);
			}
		});

		// register click handlers in the main search form (data irrespective or currently viewed tab)
		$('#resultsPerPage').on('change', function () {
			SINGLEPAGE.INTERFACE.setParameters({
				pageSize: $(this).selectpicker('val')
			});
		});

		// now restore the page state from the query parameters
		var searchSettings = fromQueryString(new URI().search());
		if (searchSettings != null) {
			toPageState(searchSettings);
		}
	});


	// Restore page when using back/forward
	window.addEventListener("popstate", function() {
		// TODO prevent clobbering page.next
		// TODO fix
		// right now prev->dosearch->overwrite future with new history entry
		var searchSettings = fromQueryString(new URI().search());
		toPageState(searchSettings || {});
	});

	function fromQueryString(queryString) {
		var decodedQuery = new URI().search(queryString).search(true);
		return decodedQuery.search ? JSON.parse(decodedQuery.search) : null;
	}

	function toQueryString(searchParams) {
		
		var modifiedParams ={} 
		
		// remove null, undefined, empty strings and empty arrays
		$.each(searchParams, function(key, value) {
			if (value == null)
				return true;
			if (value.length === 0)
				return true;
			modifiedParams[key] = value;
		});
		
		return new URI().search({
			search: JSON.stringify(modifiedParams)
		}).search();
	}

	function toPageState(searchParams) {
		// reset and repopulate the main form
		SINGLEPAGE.FORM.reset(); 
		$('#querybuilder').data('builder') && $('#querybuilder').data('builder').reset();
		$('#querybox').val(undefined);
		if (searchParams.pattern) {
			if (searchParams.pattern.constructor === Array) {
				$.each(searchParams.pattern, function (index, element) {
					SINGLEPAGE.FORM.setPropertyValues(element);
				});
			} else {
				$("#querybox").val(searchParams.pattern);
				$('#searchTabs a[href="#query"]').tab('show');
			}
		}

		$.each(searchParams.filters, function (index, element) {
			SINGLEPAGE.FORM.setFilterValues(element.name, element.values);
		});

		// Restore the results per page
		$('#resultsPerPage').selectpicker('val', [searchParams.pageSize || 50]);

		// in some cases we want to show a tab here, in some cases we don't 
		// determine when 
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
			
			// Get the correct pattern based on selected tab
			var queryType = $('#searchTabs li.active .querytype').attr('href');
			if (queryType === "#simple") {
				pattern = SINGLEPAGE.FORM.getActiveProperties();
			} else if (queryType === "#advanced") {
				pattern = $('#querybuilder').data('builder').getCql();
			} else {
				pattern = $("#querybox").val();
			}

			SINGLEPAGE.INTERFACE.setParameters({
				page: 0,
				viewGroup: null, // reset, as we might be looking at a detailed group
				pageSize: $('#resultsPerPage').selectpicker('val'),
				pattern: pattern,
				filters: SINGLEPAGE.FORM.getActiveFilters(),
			}, true);

			// Setting parameters refreshes the active tab, 
			// but when there is no tab, activate one manually
			if (!$('#resultTabs .active').length) {
				if (pattern) {
					$('#resultTabs a[href="#tabHits"]').tab('show');
				} else {
					$('#resultTabs a[href="#tabDocs"]').tab('show');
				}
			}

			// May be used as click handler, so prevent event propagation
			return false;
		},

		onSearchUpdated: function(searchParams) {
			history.pushState(null, null, toQueryString(searchParams));
		},

		// Called to reset search form and results
		resetPage: function() {
			history.pushState(null, null, "?");
			toPageState({});
			return false;
		},
	};
})();