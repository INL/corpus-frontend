// search.js:
// Some utility and user interface related functions, shared between the old (paging) and new (single-page) interface.

// Our global symbol
var BLSEARCH = {};

(function () {

	"use strict";
	
	// Join an array of strings, escaping any glue characters that occur in the values
	// (also see safeSplit in singlepage.js)
	// This is done to make sure regex characters in metadata Lucene query values won't create problems
	// The joined value is only used in frontend URLs and is split again before being sent to BLS.
	function safeJoin(values) {
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i].replace(/\$/, "$$").replace(/\|/, "$P");
		}
		return values.join("|");
	}

	var SEARCHPAGE = BLSEARCH.SEARCHPAGE = {};
	
	// Lucene query filters for active metadata filter fields
	BLSEARCH.filtersSinglePage = {};

	// Make sure we always see an overview of our specified filters
	//--------------------------------------------------------------------
	function setUpFilterOverview() {
		
		// Currently active filter values
		var ar_ActiveFilters = [];

		// Add/update element in the list of filter elements
		function addToActiveFilterList(element) {
			
			// Get filter element name, including the tab name
			function getElementName(element) {
				var tab = element.closest(".tab-pane").attr("id");
				
				if(tab)
					tab = tab + "-";
				else
					tab = "";
				
				return  tab + element.attr("placeholder");
			}

			// Remove a filter from the filter list.
			function removeFromFilterList(filter) {
				var newArray = [];
				for(var i = 0; i < ar_ActiveFilters.length; i++) {
					if(ar_ActiveFilters[i].filter != filter)
						newArray.push(ar_ActiveFilters[i]);
				}
				
				ar_ActiveFilters = newArray;
			}
			
			removeFromFilterList(getElementName(element));
			
			if (element.val() != '' && element.val() != null) {
				var filter = {
					fieldName: element.attr('name'),
					filter: getElementName(element),
					values: element.val()
				};
			
				ar_ActiveFilters.push(filter);
			}
		}
		
		// Update the filter description using the active filter value list
		// NOTE: also updates BLSEARCH.filterSinglePage, which are Lucene queries that will
		//       eventually be sent to BlackLab Server.
		function updateFilterOverview() {
			var overview = "";
			BLSEARCH.filtersSinglePage = {};
			var fromToDone = {};
			for(var i = 0; i < ar_ActiveFilters.length; i++) {
				if (overview.length > 0)
					overview += "; ";
				overview += ar_ActiveFilters[i].filter + ": <i>" + ar_ActiveFilters[i].values + "</i>";
				
				var fieldName = ar_ActiveFilters[i].fieldName;
				var values = ar_ActiveFilters[i].values;
				if (fieldName.match(/__(from|to)$/)) {
				    var name = fieldName.replace(/__(from|to)$/, "");
				    if (!fromToDone[name]) {
				    	fromToDone[name] = true;
					    var from = $("#" + name + "__from").val() || 0;
					    var to = $("#" + name + "__to").val() || 3000;
					    if (from != 0 || to != 3000)
					    	BLSEARCH.filtersSinglePage[name] = "[" + from + " TO " + to + "]";
				    }
				} else if (typeof values === 'string') {
					var name = ar_ActiveFilters[i].fieldName;
					BLSEARCH.filtersSinglePage[name] = values;
				} else {
					// Array
					if (values.length > 0) {
						BLSEARCH.filtersSinglePage[fieldName] = safeJoin(values);
					}
				}
			}
			
			$("#filteroverview").html(overview);
		}

		// When form input changes, update filter overview
		$(".forminput").change(function () {
			var element = $(this);
			
			addToActiveFilterList(element);
			
			updateFilterOverview();
		});
		
		// Check which metadata fields are filled in, and update the display
		// and array of Lucene queries accordingly.
		// Called when e.g. the user first arrives on the page, or uses the back/forward
		// button, etc. because we don't know what fields are filled in at that time.
		function checkAllFilters() {
			// for each input item that already has items selected
			$(".forminput").each(function (index) {
				var element = $(this);
				
				addToActiveFilterList(element);
			});
			updateFilterOverview();
		}
		checkAllFilters();
		
		SEARCHPAGE.updateFilterOverview = updateFilterOverview;
		SEARCHPAGE.checkAllFilters = checkAllFilters;
	}
    
	SEARCHPAGE.filtersSetup = function () {
//		setUpMultiSelectExpanders();
		setUpFilterOverview();
	};
	
    
})();
