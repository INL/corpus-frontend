// main.js:
// Function to scroll to results and filter-related functions.

// Hide the waiting message and animation. Used if an error occurs.
function hideWaitDisplay() {
    $('#waitDisplay').hide();
}

// Scroll to the results area
function scrollToResults() {
	$('html, body').animate({scrollTop: $("#results").offset().top - 70}, 300);
}

// Make our multi-select dropdown lists work
function addMultiSelectExpanders() {
	
	// If the input gains focus, show and focus the multiselect instead
	$('input.multiselect').focusin(function () {
        var name = this.id.split(/-/)[0];
        $('#' + name + '-select')
            .show()
            .focus();
        $('#' + name + '-hint').show();
        $(this).hide();
    });

	// Update description of selected options in input field
    function updateMultiselectDescription(name) {
        var opts = $("#" + name + "-select option:selected");
        var desc = "";
        for (var i = 0; i < opts.length; i++) {
            if (desc.length > 0)
                desc += ", ";
            desc += opts[i].innerHTML;
        }
        $('#' + name + '-input')
        	.val(desc)
        	.show();
    }
    
	$('select.multiselect')
		.focusout(function () {
			// If the multiselect loses focus, hide it and update the input
	        var name = this.id.split(/-/)[0];
	        updateMultiselectDescription(name);
	        $(this).hide();
	        $('#' + name + '-hint').hide();
	    })
	    .each(function (index, sel) {
	    	// Set description of initially selected options
	        var name = sel.id.split(/-/)[0];
	    	updateMultiselectDescription(name);
	    });
}

// Make sure we always see an overview of our specified filters
function addFilterOverview() {
	$(".forminput").change(function () {
		var element = $(this);
		
		addToList(element);
		
		updateFilterOverview();
	});
	
	// for each input item that already has items selected
	$(".forminput").each(function(index){
		var element = $(this);
		
		addToList(element);
	});
	
	updateFilterOverview();
}

// Add element to the list of filter elements
function addToList(element) {	
	removeFromFilterList(getElementName(element));
	
	if(element.val() != '' && element.val() != null) {
		var filter = {filter: getElementName(element), values: element.val()};
	
		ar_ActiveFilters.push(filter);
	}
}

// Get filter element name, including the tab name
function getElementName(element) {
	var tab = element.closest(".tab-pane").attr("id");
	
	if(tab)
		tab = tab + "-";
	else
		tab = "";
	
	return  tab + element.attr("placeholder");
}

// Update the filter description using the active filter value list
function updateFilterOverview() {
	var overview = "";
	for(var i = 0; i < ar_ActiveFilters.length; i++) {
		if (overview.length > 0)
			overview += "; ";
		overview += ar_ActiveFilters[i].filter + ": <i>" + ar_ActiveFilters[i].values + "</i>";
	}
	
	$("#filteroverview").html("<small>" + overview + "</small>");
}

// Remove a filter from the filter list. Used when value changes.
function removeFromFilterList(filter) {
	var newArray = [];
	for(var i = 0; i < ar_ActiveFilters.length; i++) {
		if(ar_ActiveFilters[i].filter != filter)
			newArray.push(ar_ActiveFilters[i]);
	}
	
	ar_ActiveFilters = newArray;
}

// Currently active filter values
var ar_ActiveFilters = [];