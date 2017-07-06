
var SINGLEPAGE = {};

(function () {
	"use strict";
	
	// False: viewing (grouped) hits; true: viewing (grouped) docs
	var viewingDocs = false;

	// Are we looking at grouped results?
	var groupBy = null;
	
	// Are we viewing one specific group?
	var viewGroup = null;

	// How is current result set sorted (for paging)
	var sortBy = null;

	// Number of results per page
	SINGLEPAGE.resultsPerPage = 50;

	// Is the current sort reversed from the default?
	var currentSortReverse = false;

	// First result to request (paging)
	var showFirstResult = 0;

	// Total number of pages
	SINGLEPAGE.totalPages = 0;
	
	// Are we updating the page from the URL at the moment?
	// If so, switch off stuff that can only be initiated by user actions,
	// such as performing searches.
	var updatingPage = false;

	// Special fields (titleField, authorField, dateField, pidField) in our corpus.
	// These are just some defaults, merged with actual values on load.
	var corpusDocFields = {
		"titleField": "title",
		"authorField": "author",
		"dateField": "date",
		"pidField": "pid"
	};

	// The currently selected query tab (simple or query)
	var currentQueryType = "";
	
    var numOfGroupResultsLoaded = {};
    
    var totalGroupResults = {};
    
    // If tab was just shown, don't fade the results like we do otherwise
    var skipResultsFade = false;
	
    var ELLIPSIS = String.fromCharCode(8230);

	// To enable support for HTML5-History-API polyfill in your library
	var location = window.history.location || window.location;

	// Update the URL using the history API; then update the page by calling 
	// the callback function set by the user
	function goToUrl(url) {
		history.pushState(null, null, url);
		updatePage();
		return false;
	}

	// Restore page when using back/forward
	window.addEventListener("popstate", updatePage);
	
	SINGLEPAGE.showWaitStatus = function () {
		alert(doingRegularSearch);
		alert(retrievingCorpusInfo);
	};
	
	var doingRegularSearch = false;
	
	function toggleWaitAnimation(b) {
		doingRegularSearch = b;
		//console.log("WAIT ANIM " + (b ? "ON" : "OFF"));
		$("#waitDisplay").toggle(retrievingCorpusInfo || doingRegularSearch);
	}
	
	var retrievingCorpusInfo = false;
	
	function toggleWaitAnimationCorpusInfo(b) {
		retrievingCorpusInfo = b;
		$("#waitDisplay").toggle(retrievingCorpusInfo || doingRegularSearch);
	}
	
	// (Re)create the HTML for the pagination buttons
	function updatePagination() {
		
		var currentPage = Math.ceil(showFirstResult / SINGLEPAGE.resultsPerPage);
		var startPage = Math.max(currentPage - 10, 0);
		var endPage = Math.min(currentPage + 10, SINGLEPAGE.totalPages);
		
		var html = [];
		if (currentPage == 0)
			html.push("<li class='disabled'><a>Prev</a></li>");
		else
			html.push("<li><a href='#' onclick='return SINGLEPAGE.goToPage(", currentPage - 1, ");'>Prev</a></li>");
		
		if (startPage > 0)
			html.push("<li class='disabled'><a>...</a></li>");
		
		for(var i = startPage; i < endPage; i++) {
			var showPageNumber = i + 1;
			if (i == currentPage)
				html.push("<li class='active'><a>", showPageNumber, "</a></li>");
			else 
				html.push("<li><a href='#' onclick='return SINGLEPAGE.goToPage(", i, ");'>", showPageNumber, "</a></li>");
		}
		
		if (endPage < SINGLEPAGE.totalPages)
			html.push("<li class='disabled'><a>...</a></li>");
		
		if (currentPage == (SINGLEPAGE.totalPages - 1))
			html.push("<li class='disabled'><a>Next</a></li>");
		else
			html.push("<li><a href='#' onclick='return SINGLEPAGE.goToPage(", currentPage + 1, ")'>Next</a></li>");

		$(".pagebuttons").html(html.join(""));
		
	};
	
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
    
    // Shows an error that occurred when contacting BLS to the user.
    // Expects an object with 'code' and 'message' properties.
    SINGLEPAGE.showBlsError = function (error) {
		if (typeof error == "string")
			error = {"message": error};
		$("#results").hide();
		$("#errorDiv").show();
		var code = error.code ? " (" + error.code + ")" : "";
		$("#errorMessage").text(error.message + code);
		toggleWaitAnimation(false);
	};
    
	// Parse our url query parameters, synchronize form and page state with them
	// Then execute a search based on the new page state.
	// Reason for updating the page state prior to searching is to allow this function to be called on initial page load
	function updatePage() {
		if (!corpus)
			throw new Error("Corpusinfo must be known prior to setting page state");
		
		updatingPage = true;
		try {
			var param = getUrlVariables();
			
			var hasSearch = location.search != null && location.search.length > 1;
			
			viewingDocs = param["view"] == "docs";
			groupBy = param.group;
			// Restore selectpickers indicating current grouping
			if (groupBy) {
				if (viewingDocs)
					$("#groupDocsBy").selectpicker('val', groupBy.split(","));
				else
					$("#groupHitsBy").selectpicker('val', groupBy.split(","));				
			}
			
			viewGroup = param.viewgroup || null;
			var showingGroups = groupBy != null && viewGroup == null;
			if (hasSearch) {
				// Activate the right results tab
				if (viewingDocs) {
					if (showingGroups)
						$('#contentTabs a[href="#tabDocsGrouped"]').tab('show');
					else
						$('#contentTabs a[href="#tabDocs"]').tab('show');
				} else {
					if (showingGroups)
						$('#contentTabs a[href="#tabHitsGrouped"]').tab('show');
					else
						$('#contentTabs a[href="#tabHits"]').tab('show');
				}
			}
			
		
			// Word property fields
			//----------------------------------------------------------------
			
			// Fill in word property fields
			for (var i = 0; i < wordProperties.length; i++) {
				var prop = wordProperties[i];
				var value = param[prop] ? param[prop] : "";
				var caseSensitive = false;
				if (value.length > 0 && value.match(/^\(\?c?f?\)/)) {
					if (value.charAt(2) == 'c') {
						caseSensitive = true;
						value = value.substr(4);
					}
				}
				value = makeRegexWildcard(value);
				$("#" + prop).val(value);
				if (value.length > 0) {
					// Only change checks if actually searched on this field
					$("#" + prop + "_case").prop('checked', caseSensitive);
				}
			}
			
			// Metadata fields
			//----------------------------------------------------------------
			
			// Empty all fields
			$("select.forminput option").prop("selected", false);
			$("input[type='text'].forminput").val("");
			$("input[type='checkbox'].forminput").prop("checked", false);
			
			for (var key in param) {
				// Metadata fields in query param begin with _ to distinguish them
				if (param.hasOwnProperty(key) && key.charAt(0) == '_') { 
					var filterName = key.substr(1);
					BLSEARCH.SEARCHPAGE.setFilterValues(filterName, param[key]);
				}
			}
			
			// Sort/group
			//----------------------------------------------------------------
			
			sortBy = param.sort || null;
			currentSortReverse = false;
			if (sortBy && sortBy.length >= 1 && sortBy.charAt(0) == '-') {
				currentSortReverse = true;
				sortBy = sortBy.substr(1);
			}
			
			// Preferred number of results
			//----------------------------------------------------------------
			
			SINGLEPAGE.resultsPerPage = param.number || 50;
			if (SINGLEPAGE.resultsPerPage > 200)
				SINGLEPAGE.resultsPerPage = 200;
			$("#resultsPerPage").val(SINGLEPAGE.resultsPerPage);
			
			// Search tab selection
			//----------------------------------------------------------------
			
			// Select the right tabs
			if (param.patt) {
				// CQL Query
				$('#searchTabs li:eq(2) a').tab('show');
				$('#querybox').val(param.patt);
			} else {
				// Simple query
				$('#searchTabs a:first').tab('show');
			}
			
			// Results area
			//----------------------------------------------------------------
			
			$("#errorDiv").hide();
			//$("#searchSummary").html("&nbsp;");
			//$("#totalsReport").hide();
			$('#results').toggle(hasSearch); // show waiting animation
			if (hasSearch) {
				// Is the search still running?
				var stillSearching = true;
				
				// Show wait animation only if searching takes some time
				setTimeout(function () {
					if (stillSearching)
						toggleWaitAnimation(true);
				}, 250);
				
				function updatePageWithBlsData(data) {
					$('#resultsTabs').show();
					
					var summary = data.summary;
					
					var isGrouped = false;
					if (data.hits) {
						updateHitsTable(data);
						// Totals is done in BLS.search();
					} else if (data.docs) {
						updateDocsTable(data);
						// Totals is done in BLS.search();
					} else if (data.hitGroups) {
						$("#totalsReport").hide();
						isGrouped = true;
						updateGroupedTable(data, false);
					} else if (data.docGroups) {
						$("#totalsReport").hide();
						isGrouped = true;
						updateGroupedTable(data, true);
					}
					
					// Summary, element visibility
					var patt = summary.searchParam.patt;
					var duration = summary.searchTime / 1000.0;
					$("#searchSummary").show().html("Query: " + patt + " - Duration: " + duration + "</span> sec");
					if (!isGrouped) {
						showFirstResult = summary.windowFirstResult;
						updatePagination();
						$(".pagination").show();
					} else {
						$(".pagination").hide();
					}
					$("#contentTabs").show();
					
		    		stillSearching = false; // don't show wait animation now.
		    		toggleWaitAnimation(false);
					setTimeout(function () {
						// Scroll to results
						$('html, body').animate({scrollTop: $("#results").offset().top - 70}, 300);
					}, 1);
				}
				
				BLS.search(getParam(), updatePageWithBlsData, function (error) {
					stillSearching = false;
					SINGLEPAGE.showBlsError(error);
				});
			} else {
				// No search
				$("#contentTabs").hide();
				$("#searchSummary").hide();
				$('#results').hide();
			}
		} finally {
			updatingPage = false;
		}
	}
	
    function replaceTableBodyContent(id, html, fade, onComplete) {
	    var table = $("#" + id);
	    var tableBody = $("#" + id + " tbody");
	    if (fade) {
			table.fadeOut('fast', function () {
				tableBody.html(html);
				if (onComplete)
					onComplete();
				table.fadeIn('fast');
			});
	    } else {
			tableBody.html(html);
			if (onComplete)
				onComplete();
	    }
    }
    
	function updateGroupedTable(data, isDocs) {
		var type = isDocs ? 'doc' : 'hit';
		var typeCap = isDocs ? 'Doc' : 'Hit';
		
		// No group results loaded yet
		numOfGroupResultsLoaded = {};
		totalGroupResults = {};
		
	    var html;
		var summary = data.summary;
		var groups = data[type + 'Groups'];
		var patt = summary.searchParam.patt;
		var idPrefix = isDocs ? 'dg' : 'hg';
		var prCls = isDocs ? 'warning' : 'success'; // orange or green, resp.
	    if (groups && groups.length > 0) {
			html = [];
			for (var i = 0; i < groups.length; i++) {
				var group = groups[i];
				var identity = group.identity;
				var idDisplay = group.identityDisplay;
				var size = group.size;
				var width = size * 100 / summary.largestGroupSize;
		        
		        html.push("<tr><td>", idDisplay, "</td>",
	                "<td><div class='progress' data-toggle='collapse' data-target='#", idPrefix, i, "' style='cursor:pointer;'>",
	                "<div class='progress-bar progress-bar-", prCls, "' style='width: ", width, "%;'>", size, "</div></div>",
	                "<div class='collapse groupcontent' id='", idPrefix, i, "' data-group='", identity, "'>",
	                "<div class='inline-concordance'>",
	                "<a class='btn btn-sm btn-link' href='#' onclick=\"return SINGLEPAGE.showDetailedGroup('", idPrefix, i, "');\">",
	                "&#171; View detailed concordances in this group</a> - ",
	                "<a class='btn btn-sm btn-link' href='#' onclick=\"return SINGLEPAGE.getGroupContent('", idPrefix, i, "');\">",
	                "Load more concordances...</a></div></div></td></tr>");
			}
	    } else {
	    	html = [
	    	    "<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
	    	    "No results were found. Please check your query and try again.</div></td></tr>"
	    	];
	    }

	    $('#results' + typeCap + 'sGrouped').show();
	    skipResultsFade = false;
	    replaceTableBodyContent(type + "sGroupedTable", html.join(""), !skipResultsFade, function () {
			$('.groupcontent').on('show.bs.collapse', function() {
	    		ensureGroupResultsLoaded(this.id);
	        });
	    });
	}
	
	function updateHitsTable(data) {
	    var html;
		var summary = data.summary;
		var hits = data.hits;
		var docs = data.docInfos;
		var prevDocPid = null;
		var patt = summary.searchParam.patt;
		var pattPart = patt ? "&query=" + encodeURIComponent(patt) : "";
	    if (hits && hits.length > 0) {
			html = [];
			for (var i = 0; i < hits.length; i++) {
				var hit = hits[i];
				// Add the document title and the hit information
				var docPid = hit.docPid;
				var startPos = hit.start;
				var endPos = hit.end;
		        var doc = docs[docPid];
		        var linkText = doc[corpusDocFields.titleField] || "UNKNOWN";
		        if (doc[corpusDocFields.authorField])
		        	linkText += " by " + doc[corpusDocFields.authorField];
		        if (doc[corpusDocFields.dateField])
		        	linkText += " (" + doc[corpusDocFields.dateField] + ")";
		        if (!prevDocPid || hit.docPid != prevDocPid) {
		        	// Document title row 
		        	prevDocPid = hit.docPid;
		        	var url = "article?doc=" + encodeURIComponent(docPid) + pattPart;
                    html.push("<tr class='titlerow'><td colspan='5'>",
                    	"<div class='doctitle collapse in'>",
                    	"<a class='text-error' target='_blank' href='", url, 
                    	"'>", linkText,"</a></div></td></tr>");
		        }
		        
		        // Concordance row
		        var date = doc.yearFrom;
		        var parts = snippetParts(hit);
		        var matchLemma = words(hit.match, "lemma", false, "");
			    var matchPos = words(hit.match, "pos", false, "");
		        html.push("<tr class='concordance' onclick='SINGLEPAGE.showCitation(this, \"",
		        	docPid, "\", ", startPos, ", ", endPos,
		        	");'><td class='tbl_conc_left'>",
		        	ELLIPSIS, " ", parts[0], "</td><td class='tbl_conc_hit'>", parts[1],
		        	"</td><td>", parts[2], " ", ELLIPSIS, "</td><td>", matchLemma, 
		        	"</td><td>", matchPos, "</td></tr>");
		        
		        // Snippet row
		        html.push("<tr class='citationrow'><td colspan='5'>",
		        	"<div class='collapse inline-concordance'>Loading...</div>",
                    "</td></tr>");
			}
	    } else {
	    	html = [
	    	    "<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
	    	    "No results were found. Please check your query and try again.</div></td></tr>"
	    	];
	    }
	    
	    replaceTableBodyContent('hitsTable', html.join(""), !skipResultsFade);
	    skipResultsFade = false;
	}
	
	function updateDocsTable(data) {
	    var html;
		var summary = data.summary;
		var docs = data.docs;
		var patt = summary.searchParam.patt;
		var pattPart = patt ? "&query=" + encodeURIComponent(patt) : "";
	    if (docs && docs.length > 0) {
			html = [];
			for (var i = 0; i < docs.length; i++) {
				var doc = docs[i];
				// Add the document title and the hit information
				var docPid = doc.docPid;
				var numberOfHits = doc.numberOfHits;
		        var docInfo = doc.docInfo;
		        var linkText = docInfo[corpusDocFields.titleField] || "UNKNOWN";
		        if (docInfo[corpusDocFields.authorField])
		        	linkText += " by " + docInfo[corpusDocFields.authorField];
		        //if (docInfo[corpusDocFields.dateField])
		        //	linkText += " (" + docInfo[corpusDocFields.dateField] + ")";
	        	var url = "article?doc=" + encodeURIComponent(docPid) + pattPart;
		        
		        // Concordance row
		        var date = docInfo[corpusDocFields.dateField] || ""; //.yearFrom;
		        
		        var docSnippets = doc.snippets;
		        if (docSnippets) {
			        var snippets = [];
			        for (var j = 0; j < docSnippets.length; j++) {
			        	var hit = docSnippets[j];
			        	var parts = snippetParts(hit);
			        	snippets.push(ELLIPSIS + " " + parts[0] + "<strong>" + parts[1] + "</strong>" + parts[2] + ELLIPSIS + "<br/>");
			        	
			        	break; // only need the first snippet for now
			        }
		        } else {
		        	snippets = [""];
		        }
		        
		        html.push("<tr><td><a target='_blank' href='", url, "'>", linkText, "</a><br/>",
		        		snippets[0],
                        "<a class='green btn btn-xs btn-default' target='_blank' href='", url,
                        "'>View document info</a>",
                        "</td><td>", date, "</td><td>", numberOfHits, "</td></tr>");
			}
	    } else {
	    	html = [
		    	    "<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
		    	    "No results were found. Please check your query and try again.</div></td></tr>"
		    	];
	    }
	    replaceTableBodyContent('docsTable', html.join(""), !skipResultsFade);
	    skipResultsFade = false;
	}
	
	function snippetParts(hit) {
        var punctAfterLeft = hit.match.word.length > 0 ? hit.match.punct[0] : "";
        var left = words(hit.left, "word", false, punctAfterLeft);
        var match = words(hit.match, "word", false, "");
        var right = words(hit.right, "word", true, "");
        return [left, match, right];
	}
	
	function makeQueryString(param) {
		
		var modifiedparams = $.extend(true, {}, param);
		$.each(modifiedparams.filters, function(index, filter) {
			modifiedparams["_" + filter.filterName] = filter.values;
		});
		
		delete modifiedparams.filters;
		
		return new URI().search(modifiedparams).query();
	}
	
	function makeWildcardRegex(original) {
		return original
			.replace(/([\^$\-\\.(){}[\]+])/g, "\\$1")  // add slashes for regex characters
			.replace(/\*/g, ".*")                      // * -> .*
			.replace(/\?/g, ".");                      // ? -> .
	}
	
	function makeRegexWildcard(original) {
		return original
			.replace(/\\([\^$\-\\(){}[\]+])/g, "$1")  // remove most slashes
			.replace(/\\\./g, "_ESC_PERIOD_")         // escape \.
			.replace(/\.\*/g, "*")                    // restore *
			.replace(/\./g, "?")                      // restore ?
			.replace("_ESC_PERIOD_", ".")             // unescape \. to .
			;
	}
	
	// Get url parameter description
	// These paremeters are shared between frontend and blacklab-server 
	// Though they need to be formatted into a query string still
	function getParam() {
		var param = {};
			
		// Word property fields
		//----------------------------------------------------------------
		
		var hasPattern = false;
		if (currentQueryType == "simple") {
			for (var i = 0; i < wordProperties.length; i++) {
				var prop = wordProperties[i];
				
				// Add parameters for the word property search fields
				var value = $("#" + prop).val();
				if (value.length > 0) {
					value = makeWildcardRegex(value);
					hasPattern = true;
					var caseSensitive = $("#" + prop + "_case").is(':checked');
					if (caseSensitive)
						value = "(?c)" + value;
					param[prop] = value;
				}
			}
		} else if (currentQueryType == "advanced") {
			hasPattern = true;
			param["patt"] = $('#querybuilder').data('builder').getCql();
		} else {
			hasPattern = true;
			param["patt"] = $("#querybox").val();
		}
		
		// Metadata fields
		//----------------------------------------------------------------
		
		// Copy over metadata filters (copy so we don't accidentally modify originals)
		$.extend(true, param, {"filters": BLSEARCH.SEARCHPAGE.getActiveFilters()});
		
		// Misc. parameters
		//----------------------------------------------------------------

		if (viewingDocs || !hasPattern)
			param["view"] = "docs";

		if (groupBy)
			param["group"] = groupBy;

		if (viewGroup)
			param["viewgroup"] = viewGroup;

		if (sortBy)
			param["sort"] = (currentSortReverse ? "-" : "") + sortBy;

		if (SINGLEPAGE.resultsPerPage != 50) {
			if (SINGLEPAGE.resultsPerPage > 200)
				SINGLEPAGE.resultsPerPage = 200;
			param["number"] = SINGLEPAGE.resultsPerPage;
		}

		if (showFirstResult > 0)
			param["first"] = showFirstResult;

		return param;
	};
	
	// Perform a search (search form submitted)
	function doSearch() {
		var param = getParam();
		goToUrl("?" + makeQueryString(param));
		return false;
	};
	
	// Information about the corpus we're searching
	var corpus;
	
	function getCorpusInfo() {
		toggleWaitAnimationCorpusInfo(true);
		$("#searchFormDiv").hide();
		/*$("#corpusNameTop").text("");
		$("#corpusNameMain").text("");
		$("#corpusOwner").hide();*/
	    $.ajax({
	    	url: BLS_URL,
	    	dataType: "json",
	    	success: function (data) {
	    		toggleWaitAnimationCorpusInfo(false);
	    		corpus = data;
	    		// Copy dynamic field names, can't use $.extend as fields are empty strings when undefined and would overwrite the defaults
	    		$.each(corpus.fieldInfo, function(key, val) { if (val) corpusDocFields[key] = val; });
	    		
	    		document.title = corpus.displayName + " search";
	    		$("#searchFormDiv").show();
	    		$("#corpusNameTop").text(corpus.displayName);
	    		$("#corpusNameMain").text(corpus.displayName);
	    		if (corpus.fieldInfo.dateField) {
	    			$("#groupYear").attr("value", "field:" + corpus.fieldInfo.dateField);
	    			$("#groupDecade").attr("value", "decade:" + corpus.fieldInfo.dateField);
	    			$("#docGroupYear").attr("value", "field:" + corpus.fieldInfo.dateField);
	    			$("#docGroupDecade").attr("value", "decade:" + corpus.fieldInfo.dateField);
	    		} else {
	    			$("#groupYear").attr("disabled", "disabled");
	    			$("#groupDecade").attr("disabled", "disabled");
	    			$("#docGroupYear").attr("disabled", "disabled");
	    			$("#docGroupDecade").attr("disabled", "disabled");
	    		}
	    		if (corpus.fieldInfo.titleField) {
	    			$("#groupTitle").attr("value", "field:" + corpus.fieldInfo.titleField);
	    		} else {
	    			$("#groupTitle").attr("disabled", "disabled");
	    		}
	    		if (corpus.fieldInfo.authorField) {
	    			$("#docGroupAuthor").attr("value", "field:" + corpus.fieldInfo.authorField);
	    		} else {
	    			$("#docGroupAuthor").attr("disabled", "disabled");
	    		}
	    		
	    		updatePage();
	    	},
	    	error: function (jqXHR, textStatus, errorThrown) {
	    		toggleWaitAnimationCorpusInfo(false);
	    		var data = jqXHR.responseJSON;
				if (data && data.error) {
					SINGLEPAGE.showBlsError(data.error);
				} else {
					SINGLEPAGE.showBlsError(textStatus);
				}
	    	}
	    });
	}

	// Called when the page loads
	$(document).ready(function () {
		
		toggleWaitAnimation(false);
		getCorpusInfo();
		
		BLSEARCH.SEARCHPAGE.init();
		
		// Before any searches are shown, hide all the results elements.
		$('#resultsTabs').hide(); // No results yet, don't show the empty results tabs.
		$("#contentTabs").hide();
		$("#searchSummary").hide();
		$('#results').hide();
		
		function doGroup(newGroupBy, isDocs) {
			if (newGroupBy && newGroupBy.length > 0 && newGroupBy != groupBy) {
				viewingDocs = isDocs;
				groupBy = newGroupBy.join(",");
				viewGroup = null;
				sortBy = null;
				if (groupBy.indexOf(corpusDocFields.dateField) !== -1) {
					// Grouping by year; automatically sort by group identity
					// Note: can't just see if value in newGroupBy array, values are not 1:1 with field names
					sortBy = "identity";
				}
				currentSortReverse = false;
				showFirstResult = 0;
				skipResultsFade = true;
				doSearch();
			}
		}
		$("#groupHitsBy").change(function () { doGroup($(this).val(), false); });
		$("#groupDocsBy").change(function () { doGroup($(this).val(), true); });
		
		$("#resultsPerPage").change(function () {
			var rpp = $("#resultsPerPage").val();
			if (rpp > 200)
				rpp = 200;
			if (rpp != SINGLEPAGE.resultsPerPage) {
				SINGLEPAGE.resultsPerPage = rpp;
				showFirstResult = 0;
				doSearch();
			}
		});
		
		function changeSort(newSort) {
			var sortChanged = false;
			if (sortBy != newSort) {
				// Different sort
				sortBy = newSort;
				currentSortReverse = false;
				sortChanged = true;
			} else if (newSort != null) {
				// Reverse sort
				currentSortReverse = currentSortReverse ? false : true;
				sortBy = newSort;
				sortChanged = true;
			}
			if (sortChanged)
				doSearch();
			
			// This is an onClick handler for <a>, 
			// so return false as to not propagate the click and follow the href by accident.
			return false;
		}
		$(".sortLeftWord").click(function () { changeSort("left"); });
		$(".sortLeftLemma").click(function () { changeSort("left:lemma"); });
		$(".sortLeftPos").click(function () { changeSort("left:pos"); });
		$(".sortRightWord").click(function () { changeSort("right"); });
		$(".sortRightLemma").click(function () { changeSort("right:lemma"); });
		$(".sortRightPos").click(function () { changeSort("right:pos"); });
		$(".sortGroupIdentity").click(function () { changeSort("identity"); });
		$(".sortGroupNumHits").click(function () { changeSort("numhits"); });
		
		// For the rest of the sort options, return false so the link isn't followed 
		$(".sortHitWord").click(function () { return changeSort("hit"); });
		$(".sortHitLemma").click(function () { return changeSort("hit:lemma"); });
		$(".sortHitPos").click(function () { return changeSort("hit:pos"); });
		$(".sortTitle").click(function () { return changeSort("field:" + corpusDocFields.titleField); });
		$(".sortDate").click(function () { return changeSort("field:" + corpusDocFields.dateField); });
		$(".sortNumHits").click(function () { return changeSort("numhits"); });
		
		// Keep track of the current query type tab
		$('a.querytype[data-toggle="tab"]').on('shown.bs.tab', function (e) {
			currentQueryType = e.target.hash.substr(1);
		});
		
		// Rescale the querybuilder container when it's selected
		$('a.querytype[href="#advanced"').on('shown.bs.tab hide.bs.tab', function(e) {
			$('#searchContainer').toggleClass('col-md-6');			
		});
		
		// React to the selected results tab
		$('#contentTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
			if (updatingPage) {
				//alert('ignore tab shown');
				return;
			}
			var tab = e.target.hash.substr(4).toLowerCase();
			switch(tab) {
			case "hits":
				$("#hitsTable tbody").html("");
				viewingDocs = false;
				groupBy = null;
				viewGroup = null;
				sortBy = null;
				currentSortReverse = false;
				showFirstResult = 0;
				skipResultsFade = true;
				doSearch();
				break;
			case "docs":
				$("#docsTable tbody").html("");
				viewingDocs = true;
				groupBy = null;
				viewGroup = null;
				sortBy = null;
				currentSortReverse = false;
				showFirstResult = 0;
				skipResultsFade = true;
				doSearch();
				break;
			case "hitsgrouped":
				// Shows the "group by" select
				$("#groupHitsBy").selectpicker("val", []);
				$("#hitsGroupedTable tbody").html("");
				$('#resultsHitsGrouped').hide();
				viewingDocs = false;
				groupBy = null;
				viewGroup = null;
				sortBy = null;
				currentSortReverse = false;
				showFirstResult = 0;
				break;
			case "docsgrouped":
				// Shows the "group by" select
				$("#groupDocsBy").selectpicker("val", []);
				$("#docsGroupedTable tbody").html("");
				$('#resultsDocsGrouped').hide();
				viewingDocs = false;
				groupBy = null;
				viewGroup = null;
				sortBy = null;
				currentSortReverse = false;
				showFirstResult = 0;
				break;
			}
			$(".pagination").toggle(tab == "hits" || tab == "docs");
			$(".showHideTitles").toggle(tab == "hits");
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
	    					attributes: $.map(response.properties, function(value, key) {
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
	    		$queryBuilder.on('cql:modified', function(event) {
	    			$queryBox.val(queryBuilderInstance.getCql()); 
	    		});
	    	},
	    	error: function (jqXHR, textStatus, errorThrown) {
	    		var $queryBuilder = $('#querybuilder');
	    		$queryBuilder.text("Could not get supported values for querybuilder: " + textStatus);
	    	}
	    });
		

	});
	
    function ensureGroupResultsLoaded(id) {
        if (!numOfGroupResultsLoaded[id]) {
        	SINGLEPAGE.getGroupContent(id);
        } 
    };
    
	// Get a map of the GET URL variables
	//--------------------------------------------------------------------
    function getUrlVariables() {
    	return new URI().search(true);
	};
	
    
	//===========================
	
	// Split glued string into values and unescape any glue characters in the values 
	SINGLEPAGE.safeSplit = function (str) {
		var values = str.split(/\|/);
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i].replace(/\$P/, "|").replace(/\$\$/, "$");
		}
		return values;
	};

	// Called when form is submitted
	SINGLEPAGE.searchSubmit = function () {
		showFirstResult = 0;
		sortBy = null;
		currentSortReverse = false;
		if (viewGroup) {
			// Looking at hits/docs in single group;
			// new search should be regular search, not grouped
			groupBy = null;
			viewGroup = null;
		}
		doSearch();
		return false;
	};
	
	// Called to reset search form and results
	SINGLEPAGE.resetPage = function () {
		goToUrl("?");
	};
	
	// Called to view detailed concordances of group
    SINGLEPAGE.showDetailedGroup = function (id) {
        viewGroup = $("#" + id).attr('data-group');
        doSearch();
        return false;
    };
	
	// Called to load concordances in group view
    SINGLEPAGE.getGroupContent = function (id) {
    	var element = $("#" + id);
        var start = 0;
        if (numOfGroupResultsLoaded[id]) {
            start = numOfGroupResultsLoaded[id];
        	if (start >= totalGroupResults[id]) {
        		return false; // whole group loaded
        	}
        }

        var param = getParam();
        param.viewgroup = element.attr('data-group');
        param.first = start;
        param.number = 20;
        
        function showGroupContent(data) {
        	// Update group results
    	    var html;
    	    if (data.hits) {
    	    	totalGroupResults[id] = data.summary.numberOfHitsRetrieved;
        		var hits = data.hits;
        	    if (hits && hits.length > 0) {
        			html = [];
        			for (var i = 0; i < hits.length; i++) {
        				var hit = hits[i];
        				var parts = snippetParts(hit);
        		    	html.push("<div class='clearfix'><div class='col-xs-5 text-right inline-concordance'>", 
        		    		ELLIPSIS, " ", parts[0], "</div><div class='col-xs-2 text-center inline-concordance'><b>", parts[1],
        		        	"</b></div><div class='col-xs-5 inline-concordance'>", parts[2], " ", ELLIPSIS, "</div></div>");
        			}
        	    } else {
        	    	html = ["<div class='col-xs-12'>ERROR</div>"];
        	    }
    	    } else {
    	    	totalGroupResults[id] = data.summary.numberOfDocsRetrieved;
    	    	var docs = data.docs;
    	    	if (docs && docs.length > 0) {
        			html = [];
        			for (var i = 0; i < docs.length; i++) {
        				var doc = docs[i];
        				var title = doc.docInfo[corpusDocFields.titleField];
        		        var hits = doc.numberOfHits;
        		    	html.push("<div class='clearfix'><div class='col-xs-10 inline-concordance'>",
        		    		"<b>", title, "</b></div><div class='col-xs-2 inline-concordance'>", hits,
        		    		"</div></div>");
        			}
        	    } else {
        	    	html = ["<div class='clearfix'><div class='col-xs-12'>ERROR</div></div>"];
        	    }
    	    }
    	    element.append(html.join(""));
    		var val = start + 20;
	        numOfGroupResultsLoaded[id] = val;
        }
        
        BLS.search(param, showGroupContent);

        return false;
    };
	
    // Called to navigate to a different results page
	SINGLEPAGE.goToPage = function (number) {
		showFirstResult = SINGLEPAGE.resultsPerPage * number;
		doSearch();
		return false;
	};
	
	// Show a longer snippet when clicking on a hit
	SINGLEPAGE.showCitation = function (concRow, docPid, start, end) {
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
	    	error: function (jqXHR, textStatus, errorThrown) {
	    		var data = jqXHR.responseJSON;
				if (data && data.error) {
					SINGLEPAGE.showBlsError(data.error);
				} else {
					SINGLEPAGE.showBlsError(textStatus);
				}
	    	}
	    });
    };
    
})();

