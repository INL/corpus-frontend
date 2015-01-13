// search.js:
// Some utility and user interface related functions, shared between the old (paging) and new (single-page) interface.

// Our global symbol
var BLSEARCH = {};

(function () {

	// Join an array of strings, escaping any glue characters that occur in the values
	// (also see safeSplit in singlepage.js)
	function safeJoin(values) {
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i].replace(/\$/, "$$").replace(/\|/, "$P");
		}
		return values.join("|");
	}

	var SEARCHPAGE = BLSEARCH.SEARCHPAGE = {};
	
	BLSEARCH.filtersSinglePage = {};
	
	// Make our multi-select dropdown lists work
	//--------------------------------------------------------------------
	function setUpMultiSelectExpanders() {
		
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
	    SEARCHPAGE.updateMultiselectDescription = updateMultiselectDescription;
	    
		// If the multiselect loses focus, hide it and update the input
		$('select.multiselect')
			.focusout(function () {
		        var name = this.id.split(/-/)[0];
		        // We use a timeout because we want the click to register
		        // before the page reflows
		        var that = this;
		        setTimeout(function () {
			        updateMultiselectDescription(name);
			        $(that).hide();
			        $('#' + name + '-hint').hide();
		        }, 100);
		    })
		
		// Update the text fields for all multiselects
		function updateAllMultiselectDescriptions() {
			$('select.multiselect')
			    .each(function (index, sel) {
			    	// Set description of initially selected options
			        var name = sel.id.split(/-/)[0];
			    	updateMultiselectDescription(name);
			    });
		}
		updateAllMultiselectDescriptions();
		SEARCHPAGE.updateAllMultiselectDescriptions = updateAllMultiselectDescriptions;
	}

	// Make sure we always see an overview of our specified filters
	//--------------------------------------------------------------------
	function setUpFilterOverview() {
		
		// Currently active filter values
		var ar_ActiveFilters = [];

		// Add/update element in the list of filter elements
		function addToList(element) {
			
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
		function updateFilterOverview() {
			var overview = "";
			BLSEARCH.filtersSinglePage = {};
			fromToDone = {};
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
			
			$("#filteroverview").text(overview);
		}

		// When form input changes, update filter overview
		$(".forminput").change(function () {
			var element = $(this);
			
			addToList(element);
			
			updateFilterOverview();
		});
		
		function checkAllFilters() {
			// for each input item that already has items selected
			$(".forminput").each(function (index) {
				var element = $(this);
				
				addToList(element);
			});
			updateFilterOverview();
		}
		checkAllFilters();
		
		SEARCHPAGE.updateFilterOverview = updateFilterOverview;
		SEARCHPAGE.checkAllFilters = checkAllFilters;
	}
    
	SEARCHPAGE.filtersSetup = function () {
		setUpMultiSelectExpanders();
		setUpFilterOverview();
	};
	
    
})();
