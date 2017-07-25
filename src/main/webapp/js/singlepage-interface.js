/* global BLS_URL, URI */

var SINGLEPAGE = SINGLEPAGE || {};

 /**
 * Responsible for converting search results to html.
 * Also contains functions to clear old results from the page.
 * Does not manage the main search form.
 */
SINGLEPAGE.INTERFACE = (function() {
   
	var ELLIPSIS = String.fromCharCode(8230);


	$.fn.tab.Constructor.prototype.hide = function() {
		var $this    = this.element
		var selector = $this.data('target') || $this.attr('href');

		var hideEvent = $.Event('hide.bs.tab', {
			relatedTarget: $this[0]
		})

		$this.trigger(hideEvent);
		if (hideEvent.isDefaultPrevented())
			return;

		$this.closest('li.active')
			.removeClass('active')
			.attr('aria-expanded', false)
			.trigger({
				type: 'hidden.bs.tab',
				relatedTarget: this[0]
			})
		$(selector).removeClass('active');
	}

	// var doingRegularSearch = false;

	// function toggleWaitAnimation(b) {
	// 	doingRegularSearch = b;
	// 	//console.log("WAIT ANIM " + (b ? "ON" : "OFF"));
	// 	$("#waitDisplay").toggle(retrievingCorpusInfo || doingRegularSearch);
	// }

	// var retrievingCorpusInfo = false;

	// function toggleWaitAnimationCorpusInfo(b) {
	// 	retrievingCorpusInfo = b;
	// 	$("#waitDisplay").toggle(retrievingCorpusInfo || doingRegularSearch);
	// }


	// Context of the hit is passed in arrays, per property
	// (word/lemma/PoS/punct). Right now we only want to display the 
	// words and punctuation. Join them together
	function words(context, prop, doPunctBefore, addPunctAfter) {
		var parts = [];
		var n = context[prop].length;
		for (var i = 0; i < n; i++) {
			if ((i == 0 && doPunctBefore) || i > 0)
				parts.push(context.punct[i]);
			parts.push(context[prop][i]);
		}
		parts.push(addPunctAfter);
		return parts.join("");
	}

	function snippetParts(hit) {
		var punctAfterLeft = hit.match.word.length > 0 ? hit.match.punct[0] : "";
		var left = words(hit.left, "word", false, punctAfterLeft);
		var match = words(hit.match, "word", false, "");
		var right = words(hit.right, "word", true, "");
		return [left, match, right];
	}

	/**
	 * replace the table body's html, then call a function
	 * 
	 * @param {object} $table 
	 * @param {string} html 
	 * @param {function} onComplete callback, will be called in the context of $table
	 */
	function replaceTableBodyContent($table, html, onComplete) {
		$table.animate({opacity: 0}, 200, function () {
			$table.find('tbody').html(html);
			if (onComplete)
				onComplete.call($table);
			$table.animate({opacity: 1}, 200);
		});
	}

	// Show a longer snippet when clicking on a hit
	function showCitation(concRow, docPid, start, end) {
		var element = $(concRow).next().find(".inline-concordance");
		$(element).collapse('toggle');

		$.ajax({
			url: BLS_URL + 'docs/' + docPid + '/snippet',
			dataType: "json",
			data: {
				hitstart: start,
				hitend: end,
				wordsaroundhit: 50
			},
			success: function (response) {
				var parts = snippetParts(response);
				$(element).html(parts[0] + "<b>" + parts[1] + "</b>" + parts[2]);
			},
			error: SINGLEPAGE.INTERFACE.showBlsError
		});
	}

	// Shows an error that occurred when contacting BLS to the user.
	// Expects an object with 'code' and 'message' properties.
	function showBlsError(jqXHR, textStatus, errorThrown) {
		
		var errordata = (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) || {
			"code": "WEBSERVICE_ERROR",
			"message": "Error contacting webservice: " + textStatus + "; " + errorThrown
		}
		
		$("#errorDiv").text(errordata.message + " (" + errordata.code + ") ").show();
		
		// TODO 
		//toggleWaitAnimation(false);
	}

	// (Re)create the HTML for the pagination buttons
	// TODO refactor pagination to be explicit instead of onclick SINGLEPAGE.gotopage
	function updatePagination($pagination, data) {
		var beginIndex = data.summary.windowFirstResult;
		var pageSize = data.summary.requestedWindowSize;
		var totalResults;
		if (data.summary.numberOfGroups != null)
			totalResults = data.summary.numberOfGroups;
		else 
			totalResults = (data.hits ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved);

		var totalPages =  Math.ceil(totalResults / pageSize);
		var currentPage = Math.ceil(beginIndex / pageSize);
		var startPage = Math.max(currentPage - 10, 0);
		var endPage = Math.min(currentPage + 10, totalPages);

		var html = [];
		if (currentPage == 0)
			html.push("<li class='disabled'><a>Prev</a></li>");
		else
			html.push("<li><a href='javascript:void(0)' data-page='", currentPage-1, "'>Prev</a></li>");

		if (startPage > 0)
			html.push("<li class='disabled'><a>...</a></li>");

		for (var i = startPage; i < endPage; i++) {
			var showPageNumber = i + 1;
			if (i == currentPage)
				html.push("<li class='active'><a>", showPageNumber, "</a></li>");
			else
				html.push("<li><a href='javascript:void(0)' data-page='", i, "'>", showPageNumber, "</a></li>");
		}

		if (endPage < totalPages)
			html.push("<li class='disabled'><a>...</a></li>");

		if (currentPage == (totalPages - 1) || totalPages == 0)
			html.push("<li class='disabled'><a>Next</a></li>");
		else
			html.push("<li><a href='javascript:void(0)' data-page='", currentPage + 1, "'>Next</a></li>");

		$pagination.html(html.join(""));
	}
   
	function viewConcordances() {
		// TODO this does not work as ungrouped tabs now need a group.
		
	/*
		var $button = $(this);
		var groupId = $button.data('groupId');

		// Hide the current tab (to prevent an immidiate useless seach update)
		$('#resultTabs li.active a').each(function() { $(this).tab('hide'); });
		
		SINGLEPAGE.INTERFACE.setParameters({
			viewGroup: groupId
		});

		// Then show the hits tab
		$('#resultTabs a[href="#tabHits"]').tab('show');
	*/
	}

	function loadConcordances() {
		var $button = $(this);
		var $tab = $button.parents('.tab-pane').first();
		var groupId = $button.data('groupId');
		var currentConcordanceCount = $button.data('currentConcordanceCount') || 0;
		var availableConcordanceCount = $button.data('availableConcordanceCount') || Number.MAX_VALUE;

		if (currentConcordanceCount >= availableConcordanceCount) 
			return;

		var searchParams = $.extend(
			{},
			$tab.data('defaultParameters'), 
			$tab.data('parameters'), 
			{
				pageSize: 20,
				page: currentConcordanceCount / 20,
				viewGroup: groupId
			}
		);
			
		SINGLEPAGE.BLS.search(searchParams, function(data) {
			var totalConcordances = data.hits ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved;
			var loadedConcordances = data.summary.actualWindowSize;

			// store new number of loaded elements
			$button.data('currentConcordanceCount', currentConcordanceCount + loadedConcordances);
			$button.data('availableConcordanceCount', totalConcordances);
			
			// And generate html to display
			var html = [];
			// Only one of these will run depending on what is present in the data
			// And what is present in the data depends on the current view, so all works out
			$.each(data.hits, function(index, hit) {
				var parts = snippetParts(hit);
				html.push(
					"<div class='clearfix'>",
						"<div class='col-xs-5 text-right inline-concordance'>", ELLIPSIS, " ", parts[0], "</div>",
						"<div class='col-xs-2 text-center inline-concordance'><b>", parts[1], "&nbsp;", "</b></div>",
						"<div class='col-xs-5 inline-concordance'>", parts[2], " ", ELLIPSIS, "</div>",
					"</div>");
			});

			$.each(data.docs, function(index, doc) {
					var title = doc.docInfo[data.summary.docFields.titleField];
					var hits = doc.numberOfHits;
					html.push(
						"<div class='clearfix'>",
							"<div class='col-xs-10 inline-concordance'><b>", title, "&nbsp;", "</b></div>",
							"<div class='col-xs-2 inline-concordance'>", hits, "&nbsp;", "</div>",
						"</div>");
			})

			// TODO tidy up
			$button.parent().parent().append(html.join(""));
		});
	}

	function setResultsHitsTab(data) {
		var html = [];
		if(data.hits && data.hits.length > 0 ) {
			var hitsByDocPid = {};
			$.each(data.hits, function(index, hit) {
				var arr = hitsByDocPid[hit.docPid] = hitsByDocPid[hit.docPid] || [];
				arr.push(hit);
			});

			$.each(hitsByDocPid, function(docPid, hits) {
				var doc = data.docInfos[docPid];
				var docTitle = doc[data.summary.docFields.titleField] || "UNKNOWN";
				var docAuthor = doc[data.summary.docFields.authorField] ? " by " + doc[data.summary.docFields.authorField] : "";
				var docDate = doc[data.summary.docFields.dateField] ? " (" + doc[data.summary.docFields.dateField] + ")" : "";

				var docUrl = new URI("article").search({
					"doc": docPid,
					"query": data.summary.searchParam.patt
				}).toString();

				html.push(
					"<tr class='titlerow'>",
						"<td colspan='5'><div class='doctitle collapse in'>",
							"<a class='text-error' target='_blank' href='", docUrl, "'>", docTitle, docAuthor, docDate, "</a>",
						"</div></td>",
					"</tr>");

				// Concordance row
				$.each(hits, function(index, hit) {
					var parts = snippetParts(hit);
					var matchLemma = words(hit.match, "lemma", false, "");
					var matchPos = words(hit.match, "pos", false, "");
					
					html.push(
						"<tr class='concordance' onclick='SINGLEPAGE.INTERFACE.showCitation(this, \"", docPid, "\", ", hit.start, ", ", hit.end,");'>",
							"<td class='text-right'>",ELLIPSIS, " ", parts[0], "</td>",
							"<td class='text-center'><strong>", parts[1],"</strong></td>",
							"<td>", parts[2], " ", ELLIPSIS, "</td>",
							"<td>", matchLemma, "</td>",
							"<td>", matchPos, "</td>",
						"</tr>");

					// Snippet row (initially hidden)
					html.push(
						"<tr class='citationrow'>",
							"<td colspan='5'><div class='collapse inline-concordance'>Loading...</div></td>",
						"</tr>");
				});
			});
		} else {
			html = [
				"<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
				"No results were found. Please check your query and try again.</div></td></tr>"
			];
		}

		var $tab = $('#tabHits');
		updatePagination($tab.find('.pagination'), data);
		replaceTableBodyContent($tab.find('.resultcontainer table'), html.join(""));
		$tab.find('.resultcontrols, .resultcontainer').show();
		$tab.data('results', data);
	}

	function setResultsDocsTab(data) {
		var html = [];
		if(data.docs && data.docs.length > 0 ) {
			$.each(data.docs, function(index, doc) {
				var docPid = doc.docPid;
				
				var docTitle = doc.docInfo[data.summary.docFields.titleField] || "UNKNOWN";
				var docAuthor = doc.docInfo[data.summary.docFields.authorField] ? " by " + doc[data.summary.docFields.authorField] : "";
				var docDate = doc.docInfo[data.summary.docFields.dateField] || ""; 
				var docHits = doc.numberOfHits;

				var snippetStrings = [];
				$.each(doc.snippets, function(index, snippet) {
					var parts = snippetParts(snippet);
					snippetStrings.push(ELLIPSIS, " ", parts[0], "<strong>", parts[1], "</strong>", parts[2], ELLIPSIS);
					return false; // only need the first snippet for now
				});

				var docUrl = new URI("article").search({
					"doc": docPid,
					"query": data.summary.searchParam.patt
				}).toString();

				html.push(
					"<tr>",
						"<td>",
							"<a target='_blank' href='", docUrl, "'>", docTitle, docAuthor, "</a><br>",
							snippetStrings.join(""), snippetStrings.length > 0 ? "<br>" : "", 
							"<a class='green btn btn-xs btn-default' target='_blank' href='", docUrl,"'>View document info</a>",
						"</td>",
						"<td>", docDate, "</td>",
						"<td>", docHits, "</td>",
					"</tr>");
			});
		} else {
			html = [
				"<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
				"No results were found. Please check your query and try again.</div></td></tr>"
			];
		}

		// TODO factor out explicit id lookup here (and in other set- functions)
		var $tab = $('#tabDocs');
		updatePagination($tab.find('.pagination'), data);
		replaceTableBodyContent($tab.find('.resultcontainer table'), html.join(""));
		$tab.find('.resultcontrols, .resultcontainer').show();
		$tab.data('results', data);
	}

	function setResultsGroupedTab($tab, data) {
		
		// give the display a different color based on whether we're showing hits or docs
		var displayClass = data.hitGroups ? 'progress-bar-success' : 'progress-bar-warning';
		var idPrefix = data.hitGroups ? 'hg' : 'dg'; // hitgroup : docgroup
		
		var html = [];
		var groups = data.hitGroups || data.docGroups;
		$.each(groups, function(index, group) {
			var groupId = group.identity;
			var htmlId = idPrefix + index;

			var displayName = group.identityDisplay;
			var displayWidth = (group.size / data.summary.largestGroupSize) * 100;

			html.push(
				"<tr>",
					"<td>", displayName, "</td>",
					"<td>",
						"<div class='progress group-progress' data-toggle='collapse' data-target='#", htmlId, "' style='cursor:pointer;'>",
							"<div class='progress-bar ", displayClass, "' style='min-width: ", displayWidth, "%;'>", group.size, "</div>",
						"</div>",
						"<div class='collapse' id='", htmlId, "'>",
							"<div class='inline-concordance'>",
								"<button type='button' class='btn btn-sm btn-link viewconcordances' data-group-id='", groupId, "'>&#171; View detailed concordances in this group</button> - ",
								"<button type='button' class='btn btn-sm btn-link loadconcordances' data-group-id='", groupId, "'>Load more concordances...</button>",
							"</div>",
						"</div>",
					"</td>",
				"</tr>");
		});

		if (groups == null || groups.length === 0) {
			html = [
				"<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
				"No results were found. Please check your query and try again.</div></td></tr>"
			];
		}

		function onTableContentsReplaced() {
			// first time opening the concordances for a group, load the first results
			$(this).find('.collapse').one('show.bs.collapse', function() {
				$(this).find('.loadconcordances').click();
			});
			$(this).find('.loadconcordances').on('click', loadConcordances);
			$(this).find('.viewconcordances').on('click', viewConcordances);
		}
		
		updatePagination($tab.find('.pagination'), data);
		replaceTableBodyContent($tab.find('.resultcontainer table'), html.join(""), onTableContentsReplaced);
		$tab.find('.resultcontrols, .resultcontainer').show();
		$tab.data('results', data);
	}

	function clearTabResults($tab) {
		$tab.find('.resultcontrols').hide();
		$tab.find('.resultcontainer').hide().find('tbody').empty();
		$tab.removeData('results');
	}

	/**
	 * Set new search parameters for this tab. Does not mark tab for refresh or remove existing data.
	 * 
	 * NOTE: pagination is never updated based on parameters, but instead drawn based on search response.
	 * @param {jquery} $tab - tab-pane containing all contents of tab
	 * @param {any} newParameters - object containing any updated parameter keys
	 * @param {boolean} [toPageState = false] whether to copy the parameter values to their ui elements
	 */
	function setTabParameters($tab, newParameters, toPageState) {
		// write new values while preserving original values
		var updatedParameters = $.extend($tab.data('parameters'), newParameters, $tab.data('constParameters'));

		// copy parameter values to their selectors etc
		if (toPageState) {
			var $groupSelect = $tab.find('select.groupselect');
			
			// If newParameters specified groupByHits for instance, and we are the docs tab
			// this is ok, as our defaultParameters overwrote the groupByHits value in our parameters
			// so we'll still write out groupByDocs from our parameters
			if ($groupSelect.length)
				$groupSelect.selectpicker('val', updatedParameters.groupByHits || updatedParameters.groupByDocs)
		}
	}

	/**
	 * Updates the internal parameters for a tab and executes a search if the tab is currently active.
	 * 
	 * Any currently shown results are not cleared.
	 * Automatically unhides results containers and controls once search completes.
	 * 
	 * @param {any} event where the data attribute holds all new parameters
	 */
	function onLocalParameterChange(event, parameters) {
		var $tab = $(this);

		setTabParameters($tab, parameters, true);
		$tab.removeData('results'); // Invalidate data to indicate a refresh is required

		if ($tab.hasClass('active')) // Emulate a reopen of the tab to refresh it
			$tab.trigger('tabOpen');
	}

	function onTabOpen(/*event, data*/) {
		// Always ensure data is shown
		$('#results').show();

		var $tab = $(this);
		if ($tab.data('results'))
			return; // Nothing to do, tab is already displaying data

		// Not all configurations of search parameters will result in a valid search
		// Verify that we're not trying to view hits without a pattern to generate said hits
		// and warn the user if we are
		var parameters = $tab.data('parameters');
		if (parameters.operation === 'hits' && parameters.pattern == null) {
			replaceTableBodyContent($tab.find('.resultcontainer table'),
				"<tr class='citationrow'><td colspan='5'><div class='no-results-found'>" + 
				"No hits to display... (need at least one of lemma/pos/word).</div></td></tr>"
			)
			$tab.find('.resultcontainer').show();
			$tab.find('.resultcontrols').hide();
			$tab.data('results', {}); // Prevent refreshing search on next tab open
			return;
		}

		// TODO merge groupby and regular view into same tab and remove restriction
		// probably 
		
		// Do not search if we have GroupBy parameter but no selected GroupBY
		// (this will not result in any results we can display)
		var hasGroupBy = $tab.find('select.groupselect').length > 0;
		var isGroupBySet = parameters.groupByDocs || parameters.groupByHits;

		if (hasGroupBy && !isGroupBySet) {
			replaceTableBodyContent($tab.find('.resultcontainer table'),
				"<tr class='citationrow'><td colspan='5'><div class='no-results-found'>" + 
				"No group(s) selected to display...</div></td></tr>"
			)
			$tab.find('.resultcontainer').show();
			$tab.find('.resultcontrols').hide();
			$tab.data('results', {}); // Prevent refreshing search on next tab open
			return;
		}

		// All is well, search!
		var searchSettings = $.extend({}, $tab.data('defaultParameters'), $tab.data('parameters'));
		SINGLEPAGE.CORE.onSearchUpdated(searchSettings);
		SINGLEPAGE.BLS.search(searchSettings, $tab.data('fnSetResults'), showBlsError);
	}

	return {
		init: function() {
			// Hide the results area and deactivate all tabs to prevent accidental refreshes later.
			// Tabs are unhidden when a search is submitted.
			$('#results').hide();
			$('#resultTabs a').each(function() { $(this).tab('hide'); });

			$('#tabHits')
				.data('parameters', {})
				.data('defaultParameters', {
					page: 0,
					pageSize: 50,
					pattern: null,
					filters: null,
					sort: null,
					viewGroup: null
				})
				.data('constParameters', {
					operation: 'hits',
					groupByHits: null,
					groupBydocs: null,
				})
				.data('fnSetResults', setResultsHitsTab)

			$('#tabHitsGrouped')
				.data('parameters', {})
				.data('defaultParameters', {
					page: 0,
					pageSize: 50,
					pattern: null,
					filters: null,
					sort: null,
					groupByHits: null,
					viewGroup: null
				})
				.data('constParameters', {
					operation: 'hits',
					groupByDocs: null,
				})
				.data('fnSetResults', setResultsGroupedTab.bind(undefined, $('#tabHitsGrouped')))

			$('#tabDocs')
				.data('parameters', {})
				.data('defaultParameters', {
					page: 0,
					pageSize: 50,
					pattern: null,
					filters: null,
					sort: null,
				})
				.data('constParameters', {
					operation: 'docs',
					groupByHits: null,
					groupByDocs: null,
					viewGroup: null,
				})
				.data('fnSetResults', setResultsDocsTab)

			$('#tabDocsGrouped')
				.data('parameters', {})
				.data('defaultParameters', {
					page: 0,
					pageSize: 50,
					pattern: null,
					filters: null,
					sort: null,
					groupByDocs: null,
				})
				.data('constParameters', {
					operation: 'docs',
					groupByHits: null,
					viewGroup: null
				})
				.data('fnSetResults', setResultsGroupedTab.bind(undefined, $('#tabDocsGrouped')))


			$('#resultTabsContent .tab-pane').on('localParameterChange', onLocalParameterChange);
			$('#resultTabsContent .tab-pane').on('tabOpen', onTabOpen);
			
			$('#resultTabs a').on('show.bs.tab', function() {
				$($(this).attr('href')).trigger('tabOpen');
			});

			// use indirect event capture as the sort headers might be replaced
			$('#resultTabsContent .tab-pane')
				.on('click', '[data-bls-sort]', function(event) {
					var invert = $(this).toggleClass('inverted').hasClass('inverted');
					var sort = $(this).data('blsSort');

					$(this).trigger('localParameterChange', {
						sort: invert ? "-" + sort : sort
					});
					event.preventDefault();
				})
				.on('click', '[data-page]', function(event) {
					$(this).trigger('localParameterChange', {
						page: $(this).data('page')
					});
					event.preventDefault();
				})
				.on('change', 'select.groupselect', function(event) {
					// Set both, whichever doesn't apply is nulled by the tab's constParameters anyway
					$(this).trigger('localParameterChange', {
						groupByHits: $(this).selectpicker('val'),
						groupByDocs: $(this).selectpicker('val')
					})
					event.preventDefault();
				})
		},
		
		showBlsError: showBlsError,
		showCitation: showCitation,
		
		/**
		 * Set new search parameters and mark tabs for a refesh of data.
		 * 
		 * The currently shown tab will auto-refresh.
		 * Parameters with corresponding UI-elements within the tabs will update those elements with the new data.
		 * NOTE: pagination is never updated based on parameters, but instead drawn based on search response.
		 * @param {any} searchParameters New search parameters.
		 * @param {boolean} [clearResults=false] Clear any currently displayed search results.
		 */
		setParameters: function(searchParameters, clearResults) {
			$('#resultTabsContent .tab-pane').each(function() {
				var $tab = $(this);
				if (clearResults)
					clearTabResults($tab);

				$tab.trigger('localParameterChange', searchParameters);
			});
		},

		/**
		 * Clear all results, hide the result area and reset all search parameters within the tabs.
		 * 
		 * Deactivates all tabs and hides the result area.
		 */
		reset: function() {
			// Hide the results area and deactivate all tabs to prevent accidental refreshes later.
			$('#results').hide();
			$('#resultTabs a').each(function() { $(this).tab('hide'); });

			$('#resultTabsContent .tab-pane').each(function() {
				var $tab = $(this);

				clearTabResults($tab);
				setTabParameters($tab, $.extend({}, $tab.data('defaultParameters')));
			});
		}
	}
})();