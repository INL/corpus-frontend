// search.js:
// Some utility and user interface related functions, shared between the old (paging) and new (single-page) interface.

// Our global symbol
var BLSEARCH = BLSEARCH || {}
BLSEARCH.SEARCHPAGE = (function () {

	"use strict";

	// Filters with currently valid values, values will need to be processed prior to search
	var activeFilters = [];
	
	
	// Update the filter description using the active filter value list
	var updateFilterDisplay = function() {
		
		var displayHtml = [];
		$.each(activeFilters, function(index, element) {
			displayHtml.push(element.filterName, ": ", "<i>", element.values.join(", "), " </i>");
		});
		
		$("#filteroverview").html(displayHtml.join(""));
	};
	
	// Add or update the filter in the list when it has a value.
	// Remove the filter from the list when the value is undefined/invalid.
	// Finally update the preview display with the new value
	var updateFilterField = function($filterfield) {
		
		function removeFromFilterList(filterName) {
			activeFilters = $.grep(activeFilters, function(elem) { return elem.filterName === filterName}, true);
		} 
		
		var filterName = $filterfield.attr('id');
		var filterType = $filterfield.data('filterfield-type');
		var $inputs = $filterfield.find('input, select');
		var values = [];
		
		// Has two input fields, special treatment
		if (filterType === "date") {
			var from = $($inputs[0]).val();
			var to = $($inputs[1]).val();
			
			if (from && to) // Since these are text inputs, any falsy value ('', undefined, null) is invalid
				values.push(from, to);
		} else {								
			// val might be an array (in case of multiselect), so concatenate to deal with single values as well as arrays
			var firstVal = $inputs.first().val();
			if (firstVal != null && firstVal != '')
				values = values.concat(firstVal);
		}
		
		removeFromFilterList(filterName);
		if (values.length >= 1) {
			activeFilters.push({
				filterName: filterName,
				filterType: filterType,
				values: values					
			});
		}
		
		updateFilterDisplay();
	};
	
	return {
		
		init: function() {
			// When form input changes, update filter overview
			$(".filterfield").on('change', function () {
				updateFilterField($(this));
			});
			
			this.updateAllFilters();
		},
		
		getActiveFilters: function() {
			return activeFilters;
		},
		
		// Check which metadata fields are filled in, and update the display accordingly
		// Called when e.g. the user first arrives on the page, or uses the back/forward
		// button, etc. because we don't know what fields are filled in at that time.
		updateAllFilters: function() {
			// for each input item that already has items selected
			$(".filterfield").each(function () {
				updateFilterField($(this));
			});
		},
		
		// Update the values for a filter
		// Automatically updates the preview and internal list as well
		setFilterValues: function(filterName, values) {
			var $filterField = $('#' + filterName);
			var $inputs = $filterField.find('input, select');
			var filterType = $filterField.data('filterfield-type');
			
			if (filterType == "date") {
				$($inputs[0]).val(values[0]);
				$($inputs[1]).val(values[1]);
			} else if (filterType == "select" || filterType == "multiselect") {
				$inputs.first().selectpicker('val', values);
			} else {
				$inputs.first().val(values);
			}
			
			updateFilterField($filterField);
		}
	}
})();
