// main.js:
// Function to scroll to results and filter-related functions.

// NB can be removed when we go fully single-page.

var BLSEARCH;

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
		
		// If an AJAX call failed (didn't return 200 OK, 201 created, etc.), show it on
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

	var SEARCHPAGE = BLSEARCH.SEARCHPAGE;
	
	// Set up search page stuff: search type tabs, multiselect, filter overview
	//--------------------------------------------------------------------
	SEARCHPAGE.init = function () {
		
		// (non-SINGLEPAGE only)
		
		SEARCHPAGE.filtersSetup();
		
		// Set the desired search type (hits, docs, hits grouped, docs grouped) when tab is shown
		$('a.querytype[data-toggle="tab"]').on('shown', function (e) {
			document.searchform.tab.value = e.target.hash;
		});
		
	};
	
	// Scroll to the results area
	BLSEARCH.scrollToResults = function () {
		$('html, body').animate({scrollTop: $("#results").offset().top - 70}, 300);
	};
	
	// Init grouped results page
	//--------------------------------------------------------------------
    SEARCHPAGE.initGroupedResultsPage = function (isDocsGrouped) {
        $(document).ready(function() {
            BLSEARCH.scrollToResults();
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
