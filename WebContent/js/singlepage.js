
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

// How to show the results for a URL
SINGLEPAGE.setPageUpdateFunc(function () {
	var param = BLSEARCH.UTIL.getUrlVariables();
	
	// Update results area
	$("#tabHits").html("Parameters: " + location.search);
	
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
	
	// Empty all metadata search fields
	$("select.forminput option").prop("selected", false);
	$("input[type='text'].forminput").val("");
	$("input[type='checkbox'].forminput").prop("checked", false);
	
	// Fill in metadata search fields from URL
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
				var values = value.split("||");
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
	
	// Show the filters
	// TODO: active filter list isn't updated correctly;
	//   maybe get rid of it altogether and just iterate over each
	//   field each time.
	BLSEARCH.SEARCHPAGE.updateFilterOverview();
	
	// Select the right tabs
	if (param['patt']) {
		// CQL Query
		$('#searchTabs li:eq(1) a').tab('show');
	} else {
		// Simple query
		$('#searchTabs a:first').tab('show');
	}
	
	// Results tab
	$('#contentTabs a:first').tab('show')
	
});

function spaInit() {
	// ...
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
	SINGLEPAGE.goToUrl("?" + makeQueryString(param));
	return false;
}


