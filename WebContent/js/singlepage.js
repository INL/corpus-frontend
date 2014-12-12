
// Simple way of building a single-page application.
// First, call SINGLEPAGE.setPageUpdateFunc() from a global <script> tag.
// Then, call SINGLEPAGE.goToUrl(url) to change the URL and update the page.

var SINGLEPAGE = {};

// Let the rest of the application know we're in "single page" mode
// if this script is loaded.
var singlePageApplication = true;

// False: viewing (grouped) hits; true: viewing (grouped) docs
var viewingDocs = false;

// Are we on a group tab but haven't selected group by yet?
var selectGroupBy = false;

// Are we looking at grouped results?
//var viewingGrouped = false;
var groupBy = null;

// How is current result set sorted (for paging)
var sortBy = null;

// Number of results per page
var resultsPerPage = 50;

// Is the current sort reversed from the default?
var currentSortReverse = false;

// First result to request (paging)
var showFirstResult = 0;

// Total number of pages
var totalPages = -1;

// Special fields (titleField, authorField, dateField, pidField) in our corpus.
// Right now this is only valid AFTER the first search!
// Not all fields may be provided by BLS; we use simple guesses for the rest
// (which may be wrong)
var corpusDocFields = null;

(function () {
	
	var SEARCHPAGE = BLSEARCH.SEARCHPAGE;

	// To enable support for HTML5-History-API polyfill in your library
	var location = window.history.location || window.location;
  
	// Called whenever we need to bring the page in line with the URL
	var pageUpdateFunc;

    var ELLIPSIS = String.fromCharCode(8230);
	
	// Called to set the callback function that updates the page based on the URL
	SINGLEPAGE.setPageUpdateFunc = function (callbackFunc) {
		pageUpdateFunc = callbackFunc;
	}

	// Called to update the page based on the URL
	function updatePageFromUrl() {
		if (pageUpdateFunc)
			pageUpdateFunc();
		else
			alert("No page update function set!");
	}

	// Update the URL using the history API; then update the page by calling 
	// the callback function set by the user
	SINGLEPAGE.goToUrl = function (url) {
		history.pushState(null, null, url);
		updatePageFromUrl();
		return false;
	}

	// Restore page when using back/forward
	window.addEventListener("popstate", updatePageFromUrl);

	// Restore page when editing address bar manually, or using bookmark or emailed link
	document.addEventListener('DOMContentLoaded', updatePageFromUrl);

	SINGLEPAGE.goToPage = function (number) {
		showFirstResult = resultsPerPage * number;
		SINGLEPAGE.doSearch();
		return false;
	};
	
	// (Re)create the HTML for the pagination buttons
	function updatePagination(startAtResult) {
		
		var currentPage = Math.ceil(startAtResult / resultsPerPage);
		var startPage = Math.max(currentPage - 10, 0);
		var endPage = Math.min(currentPage + 10, totalPages);
		
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
		
		if (endPage < totalPages)
			html.push("<li class='disabled'><a>...</a></li>");
		
		if (currentPage == (totalPages - 1))
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
    			parts.push(context['punct'][i]);
    		parts.push(context[prop][i]);
    	}
    	parts.push(addPunctAfter);
        return parts.join("");
    }
    
	// How to show the results for a URL
	SINGLEPAGE.setPageUpdateFunc(function () {
		
		var param = BLSEARCH.UTIL.getUrlVariables();
		
		var hasSearch = location.search != null && location.search.length > 1;
		
		viewingDocs = param["view"] == "docs";
		//viewingGrouped = !!param["group"];
		groupBy = param['group'] || null;
		if (hasSearch) {
			// Activate the right results tab
			if (viewingDocs) {
				if (groupBy != null)
					$('#contentTabs li:eq(3) a').tab('show');
				else
					$('#contentTabs li:eq(1) a').tab('show');
			} else {
				if (groupBy != null)
					$('#contentTabs li:eq(2) a').tab('show');
				else
					$('#contentTabs li:eq(0) a').tab('show');
			}
		}
		
	
		// Word property fields
		//----------------------------------------------------------------
		
		// Fill in word property fields
		for (var i = 0; i < wordProperties.length; i++) {
			var prop = wordProperties[i];
			var value = param[prop] ? param[prop] : "";
			var caseSensitive = false;
			var fuzzy = false;
			if (value.length > 0 && value.match(/^\(\?c?f?\)/)) {
				if (value.substr(2, 2) == "cf") {
					fuzzy = true;
					caseSensitive = true;
					value = value.substr(5);
				} else if (value.charAt(2) == 'c') {
					caseSensitive = true;
					value = value.substr(4);
				} else if (value.charAt(2) == 'f') {
					fuzzy = true;
					value = value.substr(4);
				}
			}
			$("#" + prop + "_text").val(value);
			if (value.length > 0) {
				// Only change checks if actually searched on this field
				$("#" + prop + "_case").prop('checked', caseSensitive);
				$("#" + prop + "_fuzzy").prop('checked', fuzzy);
			}
		}
		
		// Metadata fields
		//----------------------------------------------------------------
		
		// Empty all fields
		$("select.forminput option").prop("selected", false);
		$("input[type='text'].forminput").val("");
		$("input[type='checkbox'].forminput").prop("checked", false);
		
		// Fill in fields from URL
		for (key in param) {
			// Metadatafields start with underscore
			if (param.hasOwnProperty(key) && key.charAt(0) == '_') {
				var name = key.substr(1);
				var value = param[key];
				
				// Is it a range?
				var range = value.match(/^\s*\[(\S+)\s+TO\s+(\S+)\]\s*$/);
				if (range) {
					// Yes, set both from and to
					var from = range[1];
					if (from == 0)
						from = "";
					var to = range[2];
					if (to == 3000)
						to = "";
					$("#" + name + "__from").val(from);
					$("#" + name + "__to").val(to);
				} else if ($("#" + name + "-select").length > 0) {
					// Multiselect
					var values = BLSEARCH.UTIL.safeSplit(value);
					var selOpts = {};
					for (var i = 0; i < values.length; i++) {
						selOpts[values[i]] = true;
					}
					$("#" + name + "-select option").each(function () {
						var b = !!selOpts[this.value];
						$(this).prop("selected", b);
					});
					SEARCHPAGE.updateMultiselectDescription(name);
				} else {
					// Text or regular select
					$("#" + name).val(value);
				}
			}
		}
		
		// Show the filters for filled-in fields
		SEARCHPAGE.checkAllFilters();
		SEARCHPAGE.updateAllMultiselectDescriptions();
		
		// Sort/group
		//----------------------------------------------------------------
		
		sortBy = param['sort'] || null;
		currentSortReverse = false;
		if (sortBy && sortBy.length >= 1 && sortBy.charAt(0) == '-') {
			currentSortReverse = true;
			sortBy = sortBy.substr(1);
		}
		
		// Preferred number of results
		//----------------------------------------------------------------
		
		resultsPerPage = param['number'] || 50;
		if (resultsPerPage > 200)
			resultsPerPage = 200;
		$("#resultsPerPage").val(resultsPerPage);
		
		// Search tab selection
		//----------------------------------------------------------------
		
		// Select the right tabs
		if (param['patt']) {
			// CQL Query
			$('#searchTabs li:eq(1) a').tab('show');
		} else {
			// Simple query
			$('#searchTabs a:first').tab('show');
		}
		
		// Results area
		//----------------------------------------------------------------
		
		$("#errorDiv").hide();
		//$("#searchSummary").html("&nbsp;");
		//$("#totalsReport").hide();
		$('#results').toggle(hasSearch);
		if (hasSearch) {
			//$("#debugInfo").html(location.search);
			BLS.search(param, function (data) {
				if (data['error']) {
					var error = data['error'];
					$("#results").hide();
					$("#errorDiv").show();
					$("#errorMessage").text(error['message'] + "(" + error['code'] + ")");
			        return;
				}
				
				var summary = data['summary'];
				
				var docFields = summary['docFields'] || {};
				if (!corpusDocFields) {
					// Use obvious guesses for any missing fields
					corpusDocFields = {
						"titleField": "title",
						"authorField": "author",
						"dateField": "date",
						"pidField": "pid",
					};
					for (field in docFields) {
						if (docFields.hasOwnProperty(field))
							corpusDocFields[field] = docFields[field];
					}
				}
				
				var isGrouped = false;
				$("#showHideTitles").toggle(!!data['hits']);
				if (data['hits']) {
					updateHitsTable(data);
					totalPages = Math.ceil(summary['numberOfHitsRetrieved'] / resultsPerPage);
					$("#totalsReport").show().html(
						"Total hits: " + summary['numberOfHits'] + "<br/>" +
						"Total pages: " + totalPages
					);
				} else if (data['docs']) {
					updateDocsTable(data);
					totalPages = Math.ceil(summary['numberOfDocsRetrieved'] / resultsPerPage);
					$("#totalsReport").show().html(
						"Total docs: " + summary['numberOfDocs'] + "<br/>" +
						"Total pages: " + totalPages
					);
				} else if (data['hitGroups']) {
					$("#totalsReport").hide();
					isGrouped = true;
					selectGroupBy = false;
					updateHitsGroupedTable(data);
				} else if (data['docGroups']) {
					$("#totalsReport").hide();
					isGrouped = true;
					selectGroupBy = false;
				}
				
				// Summary, element visibility
				var patt = summary['searchParam']['patt'];
				var duration = summary['searchTime'] / 1000.0;
				$("#searchSummary").show().html("Query: " + patt + " - Duration: " + duration + "</span> sec");
				if (!isGrouped) {
					updatePagination(summary['windowFirstResult']);
					$(".pagination").show();
				} else {
					$(".pagination").hide();
				}
				$("#contentTabs").show();
				
				setTimeout(function () { BLSEARCH.UTIL.scrollToResults(); }, 1);
			});
		} else {
			// No search
			$("#contentTabs").hide();
			$("#searchSummary").hide();
		}
		
		
	});
	
	$(document).ready(function () {
		// Set up search type tabs, multiselect, filter overview
		SEARCHPAGE.init(); // also calls SINGLEPAGE.init
	});
	
	function updateHitsGroupedTable(data) {
	    var html;
		var summary = data['summary'];
		var groups = data['hitGroups'];
		var patt = summary['searchParam']['patt'];
	    if (groups && groups.length > 0) {
			html = [];
			for (var i = 0; i < groups.length; i++) {
				var group = groups[i];
				// Add the document title and the hit information
				var identity = group['identity'];
				var idDisplay = group['identityDisplay'];
				var size = group['size'];
				var width = size * 100 / summary['largestGroupSize'];
		        
		        html.push("<tr><td>", idDisplay, "</td>",
	                "<td><div class='progress progress-success' data-toggle='collapse' data-target='#g", i, "'>",
	                "<div class='bar' style='width: ", width, "%;'>", size, "</div></div>",
	                "<div class='collapse groupcontent' id='g", i, "' data-group='", identity, "'>",
	                "<div class='inline-concordance'>",
	                "<a class='btn btn-link' href='#'>&#171; View detailed concordances in this group</a> - ",
	                "<button class='btn btn-link nolink' onclick='BLSEARCH.SEARCHPAGE.getGroupContent(false, '#{$rowId}');'>", 
	                "Load more concordances...</button></div></div></td></tr>");
			}
	    } else {
	    	html = [
	    	    "<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
	    	    "No results were found. Please check your query and try again.</div></td></tr>"
	    	];
	    }
		$("#hitsGroupedTableBody").html(html.join(""));
		$('.groupcontent').on('show', function() {
    		SINGLEPAGE.ensureGroupResultsLoaded(this);
        });
	}
	
	(function () {
		
	    var numOfGroupResultsLoaded = [];
		
	    SINGLEPAGE.ensureGroupResultsLoaded = function (element) {
	    	var id = element.id;
	        if(numOfGroupResultsLoaded[id] == null) {
	        	SINGLEPAGE.getGroupContent(element);
	        } 
	    };
	    
	    SINGLEPAGE.getGroupContent = function (element) {
	    	var id = element.id;
	        var start = 0;
	        if(numOfGroupResultsLoaded[id] != null)
	            start = numOfGroupResultsLoaded[id];

	        var param = SINGLEPAGE.getParam();
	        param['viewgroup'] = $(element).attr('data-group');
	        param['first'] = start;
	        
	        BLS.search(param, function (data) {
	        	// Update group results
	    	    var html;
	    		var hits = data['hits'];
	    	    if (hits && hits.length > 0) {
	    			html = [];
	    			for (var i = 0; i < hits.length; i++) {
	    				var hit = hits[i];
	    		        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
	    		        var left = words(hit['left'], "word", false, punctAfterLeft);
	    		        var match = words(hit['match'], "word", false, "");
	    		        var right = words(hit['right'], "word", true, "");
	    		    	html.push("<div class='row-fluid '><div class='span5 text-right inline-concordance'>", 
	    		    		ELLIPSIS, " ", left, "</div><div class='span2 text-center inline-concordance'><b>", match,
	    		        	"</b></div><div class='span5 inline-concordance'>", right, " ", ELLIPSIS, "</div></div>");
	    			}
	    	    } else {
	    	    	html = ["<div class='row-fluid'>ERROR</div>"];
	    	    }
	    		$(element).append(html.join(""));
	        });

	        numOfGroupResultsLoaded[element] = start + 20;
	        
	        return false;
	    };
		
	})();
	
	function updateHitsTable(data) {
	    var html;
		var summary = data['summary'];
	    var docFields = summary['docFields'] || {};
		var hits = data['hits'];
		var docs = data['docInfos'];
		var prevDocPid = null;
		var patt = summary['searchParam']['patt'];
		var pattPart = patt ? "&query=" + encodeURIComponent(patt) : "";
	    if (hits && hits.length > 0) {
			html = [];
			for (var i = 0; i < hits.length; i++) {
				var hit = hits[i];
				// Add the document title and the hit information
				var docPid = hit['docPid'];
				var startPos = hit['start'];
				var endPos = hit['end'];
		        var doc = docs[docPid];
		        var linkText = "UNKNOWN";
		        if (docFields['titleField'] && doc[docFields['titleField']])
		        	linkText = doc[docFields['titleField']];
		        if (docFields['authorField'] && doc[docFields['authorField']])
		        	linkText += " by " + doc[docFields['authorField']];
		        if (docFields['dateField'] && doc[docFields['dateField']])
		        	linkText += " (" + doc[docFields['dateField']] + ")";
		        if (!prevDocPid || hit['docPid'] != prevDocPid) {
		        	// Document title row 
		        	prevDocPid = hit['docPid'];
		        	var url = "article?doc=" + encodeURIComponent(docPid) + pattPart;
                    html.push("<tr class='titlerow'><td colspan='5'>",
                    	"<div class='doctitle collapse in'>",
                    	"<a class='text-error' target='_blank' href='", url, 
                    	"'>", linkText,"</a></div></td></tr>");
		        }
		        
		        // Concordance row
		        var date = doc['yearFrom'];
		        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
		        var left = words(hit['left'], "word", false, punctAfterLeft);
		        var match = words(hit['match'], "word", false, "");
		        var right = words(hit['right'], "word", true, "");
		        var matchLemma = words(hit['match'], "lemma", false, "");
			    var matchPos = words(hit['match'], "pos", false, "");
		        html.push("<tr class='concordance' onclick='SINGLEPAGE.showCitation(this, \"",
		        	docPid, "\", ", startPos, ", ", endPos,
		        	");'><td class='tbl_conc_left'>",
		        	ELLIPSIS, " ", left, "</td><td class='tbl_conc_hit'>", match,
		        	"</td><td>", right, " ", ELLIPSIS, "</td><td>", matchLemma, 
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
		$("#hitsTableBody").html(html.join(""));
	}
	
	function updateDocsTable(data) {
	    var html;
		var summary = data['summary'];
	    var docFields = summary['docFields'] || {};
		var docs = data['docs'];
		var patt = summary['searchParam']['patt'];
		var pattPart = patt ? "&query=" + encodeURIComponent(patt) : "";
	    if (docs && docs.length > 0) {
			html = [];
			for (var i = 0; i < docs.length; i++) {
				var doc = docs[i];
				// Add the document title and the hit information
				var docPid = doc['docPid'];
				var numberOfHits = doc['numberOfHits'];
		        var docInfo = doc['docInfo'];
		        var linkText = "UNKNOWN";
		        if (docFields['titleField'] && docInfo[docFields['titleField']])
		        	linkText = docInfo[docFields['titleField']];
		        if (docFields['authorField'] && docInfo[docFields['authorField']])
		        	linkText += " by " + docInfo[docFields['authorField']];
		        if (docFields['dateField'] && docInfo[docFields['dateField']])
		        	linkText += " (" + docInfo[docFields['dateField']] + ")";
	        	var url = "article?doc=" + encodeURIComponent(docPid) + pattPart;
		        
		        // Concordance row
		        var date = docInfo['yearFrom'];
		        
		        var docSnippets = doc['snippets'];
		        if (docSnippets) {
			        var snippets = [];
			        for (var j = 0; j < docSnippets.length; j++) {
			        	var hit = docSnippets[j];
				        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
				        var left = words(hit['left'], "word", false, punctAfterLeft);
				        var match = words(hit['match'], "word", false, "");
				        var right = words(hit['right'], "word", true, "");
				        var matchLemma = words(hit['match'], "lemma", false, "");
					    var matchPos = words(hit['match'], "pos", false, "");
			        	snippets.push(ELLIPSIS + " " + left + "<strong>" + match + "</strong>" + 
			        			right + ELLIPSIS + "<br/>");
			        	
			        	break; // only need the first snippet for now
			        }
		        } else {
		        	snippets = [""];
		        }
		        
		        html.push("<tr><td><a target='_blank' href='", url, "'>", linkText, "</a><br/>",
		        		snippets[0],
                        "<a class='btn btn-mini green' target='_blank' href='", url,
                        "'>View document info</a>",
                        "</td><td>", date, "</td><td>", numberOfHits, "</td></tr>");
			}
	    } else {
	    	html = [
		    	    "<tr class='citationrow'><td colspan='5'><div class='no-results-found'>",
		    	    "No results were found. Please check your query and try again.</div></td></tr>"
		    	];
	    }
		$("#docsTableBody").html(html.join(""));
	}
	
	function snippetHtml(hit) {
        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
        var left = words(hit['left'], "word", false, punctAfterLeft);
        var match = words(hit['match'], "word", false, "");
        var right = words(hit['right'], "word", true, "");
        return left + "<b>" + match + "</b>" + right;
	}
	
	// Show a longer snippet when clicking on a hit
	//--------------------------------------------------------------------
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
	    		if (response['error']) {
		    		alert("Error: " + response['error']['message']);
	    		} else {
	    			$(element).html(snippetHtml(response));
	    		}
	    	},
	    	error: function (jqXHR, textStatus, errorThrown) {
	    		alert("Error: " + textStatus);
	    	}
	    });
    };
    
	SINGLEPAGE.init = function () {
		
		function doGroup(newGroupBy, isDocs) {
			if (newGroupBy && newGroupBy.length > 0 && newGroupBy != groupBy) {
				viewingDocs = isDocs;
				groupBy = newGroupBy;
				sortBy = null;
				showFirstResult = 0;
				SINGLEPAGE.doSearch();
			}
		}
		$("#groupHitsBy").change(function () { doGroup($(this).val(), false); });
		$("#groupDocsBy").change(function () { doGroup($(this).val(), true); });
		
		$("#resultsPerPage").change(function () {
			var rpp = $("#resultsPerPage").val();
			if (rpp > 200)
				rpp = 200;
			if (rpp != resultsPerPage) {
				resultsPerPage = rpp;
				SINGLEPAGE.doSearch();
			}
		});
		
		function changeSort(newSort) {
			var sortChanged = false;
			if (sortBy != newSort) {
				// Different sort
				sortBy = newSort;
				sortChanged = true;
			} else if (newSort != null){
				// Reverse sort
				sortBy = (currentSortReverse ? "" : "-") + newSort;
				sortChanged = true;
			}
			if (sortChanged)
				SINGLEPAGE.doSearch();
			return false;
		}
		$(".sortLeftWord").click(function () { changeSort("left"); });
		$(".sortLeftLemma").click(function () { changeSort("left:lemma"); });
		$(".sortLeftPos").click(function () { changeSort("left:pos"); });
		$(".sortRightWord").click(function () { changeSort("right"); });
		$(".sortRightLemma").click(function () { changeSort("right:lemma"); });
		$(".sortRightPos").click(function () { changeSort("right:pos"); });
		
		// For the rest of the sort options, return false so the link isn't followed 
		$(".sortHitWord").click(function () { return changeSort("hit"); });
		$(".sortHitLemma").click(function () { return changeSort("hit:lemma"); });
		$(".sortHitPos").click(function () { return changeSort("hit:pos"); });
		$(".sortTitle").click(function () { return changeSort("field:" + corpusDocFields['titleField']); });
		$(".sortDate").click(function () { return changeSort("field:" + corpusDocFields['dateField']); });
		$(".sortNumHits").click(function () { return changeSort("numhits"); });
		
		// Keep track of the current query type tab
		$('a.querytype[data-toggle="tab"]').on('shown', function (e) {
			SEARCHPAGE.currentQueryType = e.target.hash.substr(1);
		});
		
		// React to the selected results tab
		$('#contentTabs a[data-toggle="tab"]').on('shown', function (e) {
			var tab = e.target.hash.substr(4).toLowerCase();
			switch(tab) {
			case "hits":
				if (viewingDocs || groupBy != null) {
					viewingDocs = false;
					groupBy = null;
					sortBy = null;
					showFirstResult = 0;
					SINGLEPAGE.doSearch();
				}
				break;
			case "docs":
				if (!viewingDocs || groupBy != null) {
					viewingDocs = true;
					groupBy = null;
					sortBy = null;
					showFirstResult = 0;
					SINGLEPAGE.doSearch();
				}
				break;
			case "hitsgrouped":
				// Shows the "group by" select
				$("#groupHitsBy").val("");
				$("#hitsGroupedTableBody").html("");
				selectGroupBy = true;
				/*
				viewingDocs = false;
				groupBy = null;
				sortBy = null;
				showFirstResult = 0;
				*/
				break;
			case "docsgrouped":
				// Shows the "group by" select
				$("#groupDocsBy").val("");
				$("#docsGroupedTableBody").html("");
				selectGroupBy = true;
				/*
				viewingDocs = false;
				groupBy = null;
				sortBy = null;
				showFirstResult = 0;
				*/
				break;
			}
			$(".pagination").toggle(tab == "hits" || tab == "docs");

		});
	};
	
	function makeQueryString(param) {
		var qs = "";
		for (var key in param) {
			if (param.hasOwnProperty(key)) {
				if (qs.length > 0)
					qs += "&";
				qs += key + "=" + encodeURIComponent(param[key]);
			}
		}
		return qs;
	}
	
	/*
	SINGLEPAGE.updateWordPropAndFilter = function () {
		//@@@
	}
	*/
	
	SINGLEPAGE.getParam = function getParam() {
		var param = {};
		for (var i = 0; i < wordProperties.length; i++) {
			var prop = wordProperties[i];
			
			// Word property fields
			//----------------------------------------------------------------
			
			if (SEARCHPAGE.currentQueryType == "simple") {
				// Add parameters for the word property search fields
				var value = $("#" + prop + "_text").val();
				if (value.length > 0) {
					var id = prop + "_case";
					var caseSensitive = $("#" + id).prop('checked');
					var fuzzy = $("#" + prop + "_fuzzy").prop('checked');
					if (caseSensitive && fuzzy)
						value = "(?cf)" + value;
					else if (fuzzy)
						value = "(?f)" + value;
					else if (caseSensitive)
						value = "(?c)" + value;
					param[prop] = value;
				}
			} else {
				param["patt"] = $("#querybox").val();
			}
			
			// Metadata fields
			//----------------------------------------------------------------
			
			// Add parameters for the metadata search fields
			if (Object.keys(BLSEARCH.filters).length > 0) {
				for (key in BLSEARCH.filters) {
					if (BLSEARCH.filters.hasOwnProperty(key)) {
						var value = BLSEARCH.filters[key];
						param["_" + key] = value;
					}
				}
			}
			
		}
		
		// Misc. parameters
		//----------------------------------------------------------------

		if (viewingDocs)
			param["view"] = "docs";

		if (groupBy)
			param["group"] = groupBy;

		if (sortBy)
			param["sort"] = sortBy;

		if (resultsPerPage != 50) {
			if (resultsPerPage > 200)
				resultsPerPage = 200;
			param["number"] = resultsPerPage;
		}

		if (showFirstResult > 0)
			param["first"] = showFirstResult;

		return param;
	};
	
	// Perform a search (search form submitted)
	SINGLEPAGE.doSearch = function () {
		var param = SINGLEPAGE.getParam();
		SINGLEPAGE.goToUrl("?" + makeQueryString(param));
		return false;
	};
	
})();

