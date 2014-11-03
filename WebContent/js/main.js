// main.js:
// Function to scroll to results and filter-related functions.

// Our global symbol
var BLSEARCH = {};

(function () {
	
	var DEBUG = BLSEARCH.DEBUG = {};
	
	// Debug logging
	//----------------------------------------------------------------
	(function () {
		// Activate debug logging?
		var DO_DEBUG = true;

		// Log debug message
		DEBUG.log = function (string) {
			if (window.console && DO_DEBUG) {
				console.log(string);
			}
		};
		
		// If an AJAX call failed (didn't return 200 OK), show it on
		// the page and using an alert.
		DEBUG.showAjaxFail = function (textStatus, element) {
			$("#results .icon-spinner").hide(); // hide the waiting animation
		    $('#waitDisplay').hide(); // make sure the (sometimes) accompanying text is hidden too 

			var msg = "AJAX request failed (cross-origin error?); textStatus = " + textStatus;
			var html = "<div class='error'>" + msg + "</div>";
			$(element).html(html);
			DEBUG.log(msg);
			alert(msg);
		};

		// Log the URL and parameters of the AJAX call we're about to do
		DEBUG.logAjaxCall = function (url, parameters) {
			if (!parameters) {
				DEBUG.log(url);
				return;
			}
			paramStr = "";
			$.each(parameters, function (key, value) {
				if (paramStr.length > 0)
					paramStr += "&";
				paramStr += encodeURIComponent(key) + "=" + encodeURIComponent(value);
			});
			DEBUG.log(url + "?" + paramStr);
		};

	})();

	var UTIL = BLSEARCH.UTIL = {};

	// Scroll to the results area
	UTIL.scrollToResults = function () {
		$('html, body').animate({scrollTop: $("#results").offset().top - 70}, 300);
	};

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
	};

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
			
			if(element.val() != '' && element.val() != null) {
				var filter = {filter: getElementName(element), values: element.val()};
			
				ar_ActiveFilters.push(filter);
			}
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

		// When form input changes, update filter overview
		$(".forminput").change(function () {
			var element = $(this);
			
			addToList(element);
			
			updateFilterOverview();
		});
		
		// for each input item that already has items selected
		$(".forminput").each(function (index) {
			var element = $(this);
			
			addToList(element);
		});
		
		updateFilterOverview();
	}
	
	var SEARCHPAGE = BLSEARCH.SEARCHPAGE = {};

	// Set up search page stuff: search type tabs, multiselect, filter overview
	//--------------------------------------------------------------------
	SEARCHPAGE.init = function () {
		
		// Set the desired search type (hits, docs, hits grouped, docs grouped) when tab is shown
		$('a.querytype[data-toggle="tab"]').on('shown', function (e) {	
			document.searchform.tab.value = e.target.hash;
		});
		
		setUpMultiSelectExpanders();
		setUpFilterOverview();
	};
	
	// Init grouped results page
	//--------------------------------------------------------------------
    SEARCHPAGE.initGroupedResultsPage = function (isDocsGrouped) {
        $(document).ready(function() {
            BLSEARCH.UTIL.scrollToResults();
            $('.nolink').click(function(event) { event.preventDefault();});
            $('.groupcontent').on('show', function() { 
            	BLSEARCH.SEARCHPAGE.ensureGroupResultsLoaded(isDocsGrouped, '#' + $(this).attr('id'));
            });
        });
    }
	
	// Show a longer snippet when clicking on a hit
	//--------------------------------------------------------------------
	SEARCHPAGE.showCitation = function (url, element, docPid, start, end) {
        $(element).collapse('toggle');
        var retriever = new SEARCHPAGE.AjaxRetriever(url, 'docs/' + docPid + '/snippet');
        var param = {
            outputformat: "xml",
            hitstart: start,
            hitend: end,
            wordsaroundhit: 50
        };
        retriever.putAjaxResponse(element, param, false, "../js/concordance.xsl");
    };
    
	
	
	// Viewing single group's results in grouped view
	//--------------------------------------------------------------------
    (function () {
        var ar_loadFrom = [];
    	
        SEARCHPAGE.ensureGroupResultsLoaded = function (isDocsGrouped, element) {
            if(ar_loadFrom[element] == null) {
            	SEARCHPAGE.getGroupContent(isDocsGrouped, element);
            } 
        };
        
        SEARCHPAGE.getGroupContent = function (isDocsGrouped, element) {
            var start = 0;
            
            if(ar_loadFrom[element] != null)
                var start = ar_loadFrom[element];
                
            var retriever = new SEARCHPAGE.AjaxRetriever(backendRequestUrl, '');
            var groupid = decodeURIComponent($(element).attr('data-group'));
            retriever.putAjaxResponse(element, {
                viewgroup: groupid,
                first: start
            }, true, isDocsGrouped ? "../js/docgroup.xsl" : "../js/hitgroup.xsl");
            
            ar_loadFrom[element] = start + 20;
            
            return false;
        };
    })();
    
    
})();
