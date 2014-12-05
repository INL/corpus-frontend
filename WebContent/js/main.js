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

	// Get a map of the GET URL variables
	//--------------------------------------------------------------------
    UTIL.getUrlVariables = function () {
	    var query = window.location.search.substring(1);
	    if (query.length == 0)
	    	return {};
	    var vars = query.split("&");
        var urlVariables = {};
	    for (var i = 0; i < vars.length; i++) {
	    	var pair = vars[i].split("=");
	    	urlVariables[pair[0]] = decodeURIComponent(pair[1]);
	    }
	    return urlVariables;
	};
	
	// Join an array of strings, escaping any glue characters that occur in the values 
	UTIL.safeJoin = function (values) {
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i].replace(/\$/, "$$").replace(/\|/, "$P");
		}
		return values.join("|");
	}

	// Split glued string into values and unescape any glue characters in the values 
	UTIL.safeSplit = function (str) {
		var values = str.split(/\|/);
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i].replace(/\$P/, "|").replace(/\$\$/, "$");
		}
		return values;
	}

	var SEARCHPAGE = BLSEARCH.SEARCHPAGE = {};
	
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
		        updateMultiselectDescription(name);
		        $(this).hide();
		        $('#' + name + '-hint').hide();
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
	};

	// Make sure we always see an overview of our specified filters
	//--------------------------------------------------------------------
	BLSEARCH.filters = {};
	
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
			BLSEARCH.filters = {};
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
					    	BLSEARCH.filters[name] = "[" + from + " TO " + to + "]";
				    }
				} else if (typeof values === 'string') {
					var name = ar_ActiveFilters[i].fieldName;
					BLSEARCH.filters[name] = values;
				} else {
					// Array
					if (values.length > 0) {
						BLSEARCH.filters[fieldName] = UTIL.safeJoin(values);
					}
				}
			}
			
			$("#filteroverview").html("<small>" + overview + "</small>");
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
	
	// In SPA mode, the currently selected query tab (simple or query)
	SEARCHPAGE.currentQueryType = "";
	
	// Set up search page stuff: search type tabs, multiselect, filter overview
	//--------------------------------------------------------------------
	SEARCHPAGE.init = function () {
		
		// Set the desired search type (hits, docs, hits grouped, docs grouped) when tab is shown
		if (!singlePageApplication) {
			$('a.querytype[data-toggle="tab"]').on('shown', function (e) {
				document.searchform.tab.value = e.target.hash;
			});
		}
		
		setUpMultiSelectExpanders();
		setUpFilterOverview();
		
		if (singlePageApplication)
			spaInit();
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
