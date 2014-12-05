
// Simple way of building a single-page application.
// First, call SINGLEPAGE.setPageUpdateFunc() from a global <script> tag.
// Then, call SINGLEPAGE.goToUrl(url) to change the URL and update the page.

var SINGLEPAGE = {};

(function () {

	// Called whenever we need to bring the page in line with the URL
	var pageUpdateFunc;

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

})();

// Let the rest of the application know we're in "single page" mode
// if this script is loaded.
var singlePageApplication = true;

// Are we currently updating the page?
// If so, don't respond to change events like normally
var updatingPage = false;

// How to show the results for a URL
SINGLEPAGE.setPageUpdateFunc(function () {
	
	updatingPage = true;
	
	var param = BLSEARCH.UTIL.getUrlVariables();
	
	// Results area
	//----------------------------------------------------------------
	
	//$("#debugInfo").html(location.search);
	BLS.search(param, function (data) {
		
		// Context of the hit is passed in arrays, per property
	    // (word/lemma/PoS/punct). Right now we only want to display the 
	    // words and punctuation. Join them together
	    function words(context, doPunctBefore, addPunctAfter) {
	    	var parts = [];
	    	var n = context['word'].length;
	    	for (var i = 0; i < n; i++) {
	    		if ((i == 0 && doPunctBefore) || i > 0)
	    			parts.push(context['punct'][i]);
	    		parts.push(context['word'][i]);
	    	}
	    	parts.push(addPunctAfter);
	        return parts.join("");
	    }
	    
	    var ELLIPSIS = String.fromCharCode(8230);

	    var html;
		var hits = data['hits'];
		var docs = data['docInfos'];
	    if (hits.length > 0) {
			html = [];
			for (var i = 0; i < hits.length; i++) {
				/*
                        
                            <td class="tbl_conc_left">...  LEFT</td>
                            <td class="tbl_conc_hit">MATCH</td>
                            <td>RIGHT ...</td>
                            <td>MATCHLEMMA</td>
                            <td>MATCHPOS</td>
                        </tr> 

				 */
				var hit = hits[i];
				// Add the document title and the hit information
		        var doc = docs[hit['docPid']];
		        var date = doc['yearFrom'];
		        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
		        var left = words(hit['left'], false, punctAfterLeft);
		        var match = words(hit['match'], false, "");
		        var right = words(hit['right'], true, "");
		        html.push("<tr class='concordance'><td class='tbl_conc_left'>" + ELLIPSIS + " " + left +
		            "</td><td class='tbl_conc_hit'>" + match + "<td>" + right + " " + ELLIPSIS +
		            "</td><td>MATCHLEMMA</td><td>MATCHPOS</td></tr>");
			}
	    } else {
	    	html = ["<tr><td>NO HITS</td></tr>"];
	    }
		$("#hitsTableBody").html(html.join(""));
	});

	viewingDocs = param["view"] == "docs";
	viewingGrouped = !!param["group"];
	if (viewingDocs) {
		if (viewingGrouped)
			$('#contentTabs li:eq(3) a').tab('show');
		else
			$('#contentTabs li:eq(1) a').tab('show');
	} else {
		if (viewingGrouped)
			$('#contentTabs li:eq(2) a').tab('show');
		else
			$('#contentTabs li:eq(0) a').tab('show');
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
		$("#" + prop + "_case").prop('checked', caseSensitive);
		$("#" + prop + "_fuzzy").prop('checked', fuzzy);
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
				BLSEARCH.SEARCHPAGE.updateMultiselectDescription(name);
			} else {
				// Text or regular select
				$("#" + name).val(value);
			}
		}
	}
	
	// Show the filters for filled-in fields
	BLSEARCH.SEARCHPAGE.checkAllFilters();
	BLSEARCH.SEARCHPAGE.updateAllMultiselectDescriptions();
	
	// Preferred number of results
	//----------------------------------------------------------------
	
	var resultsPerPage = param['number'] || 50;
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
	
	updatingPage = false;
	
});

// False: viewing (grouped) hits; true: viewing (grouped) docs
var viewingDocs = false;

// Are we looking at grouped results?
var viewingGrouped = false;

// Are we selecting what to group by?
var selectingGroupBy = false;

$(document).ready(function () {
	// Set up search type tabs, multiselect, filter overview
	BLSEARCH.SEARCHPAGE.init(); // also calls spaInit
});

function spaInit() {
	
	$("#resultsPerPage,#groupHitsBy,#groupDocsBy").change(function () {
		if (!updatingPage) {
			spaDoSearch();
		}
	});
	
	// Keep track of the current query type tab
	$('a.querytype[data-toggle="tab"]').on('shown', function (e) {
		BLSEARCH.SEARCHPAGE.currentQueryType = e.target.hash.substr(1);
	});
	
	// React to the selected results tab
	$('#contentTabs a[data-toggle="tab"]').on('shown', function (e) {
		var tab = e.target.hash.substr(4).toLowerCase();
		switch(tab) {
		case "hits":
			selectingGroupBy = false;
			if (viewingDocs || viewingGrouped) {
				viewingDocs = false;
				viewingGrouped = false;
				spaDoSearch();
			}
			break;
		case "docs":
			selectingGroupBy = false;
			if (!viewingDocs || viewingGrouped) {
				viewingDocs = true;
				viewingGrouped = false;
				spaDoSearch();
			}
			break;
		case "hitsgrouped":
			// Shows the "group by" select
			$("#groupHitsBy").val("");
			selectingGroupBy = true;
			viewingDocs = false;
			break;
		case "docsgrouped":
			// Shows the "group by" select
			$("#groupDocsBy").val("");
			selectingGroupBy = true;
			viewingDocs = true;
			break;
		}
	});
}

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

// Perform a search (search form submitted)
function spaDoSearch() {
	var param = {};
	for (var i = 0; i < wordProperties.length; i++) {
		var prop = wordProperties[i];
		
		// Word property fields
		//----------------------------------------------------------------
		
		if (BLSEARCH.SEARCHPAGE.currentQueryType == "simple") {
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
		
		// Type of results
		//----------------------------------------------------------------
		
		var groupBySelect = "groupHitsBy";
		if (viewingDocs) {
			param["view"] = "docs";
			groupBySelect = "groupDocsBy";
		}
		if (viewingGrouped || selectingGroupBy) {
			var groupBy = $("#" + groupBySelect).val();
			if (groupBy && groupBy.length > 0)
				param["group"] = groupBy;
		}
		
		// Preferred number of results
		//----------------------------------------------------------------
		
		var resultsPerPage = $("#resultsPerPage").val();
		if (resultsPerPage != 50) {
			if (resultsPerPage > 200)
				resultsPerPage = 200;
			param["number"] = resultsPerPage;
		}
		
	}
	
	SINGLEPAGE.goToUrl("?" + makeQueryString(param));
	return false;
}


