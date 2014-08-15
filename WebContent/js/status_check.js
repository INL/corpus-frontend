
// Get the status of a search job
function checkStatus(backendUrl, callbackMethod) {
    // We just want the status, no actual results. Set max to 0.
    if (backendUrl.indexOf("max=") >= 0) {
        backendUrl = backendUrl.replace(/max=\d+/, "max=0");
    } else {
        backendUrl += "&max=0"; 
    }

	// Check status
    logAjaxCall(backendUrl);
    checkAgainMs = 1000; // reset to default value	
	$.ajax({
        type: "GET",
        dataType: "xml",
        url: backendUrl
    }).done(function (data) {
		callbackMethod(backendUrl, data);
	}).fail(function (jqXHR, textStatus) {
	    showAjaxFail(textStatus, $("#status"));
        //alert("AJAX request " + backendUrl + " failed (cross-origin error?); textStatus = " + textStatus);
    });
}

// Will be set to the latest suggested "check again time" by getJobStatus.
var checkAgainMs = 200;

// If a job is finished, get the results, otherwise check again later.
function loadResults(backendUrl, data) {
	var status = getJobStatus(data);
	//$("#status").text(status + "...");
	debug("Status: " + status);
	
	if (status == "ERROR" || status == "" || status.substring(0,6) == "No job") {
		showLoadingError(data);
	} else if (status == "COUNTING" || status == "FINISHED") {
		getResults();
	} else {
		setTimeout(function () {
		    checkStatus(backendUrl, loadResults);
		}, checkAgainMs); // check again after time suggested by BlackLab Server.
	}
}

// See if the result count is finished yet, and update if so. If not, check again later.
function refreshStats(backendUrl, data) {
	var status = getJobStatus(data);
	debug("Status: " + status);
	
	if (status == "ERROR" || status == "" || status.substring(0,6) == "No job") {
		showLoadingError();
	} else if (status == "FINISHED") {
		updateStats(backendUrl);
	} else {
		setTimeout(function() {
		  checkStatus(backendUrl, refreshStats);
        }, checkAgainMs); // check again 1 second from now
    }
}

// An error occurred; signal it
function showLoadingError(data) {
    $xml = $(data);
    
    var errorMessage = $xml.find("error").text();
    if (errorMessage.length > 0) {
    	debug("Error: " + errorMessage);
    	$("#status").text("Error: " + errorMessage);
    } else {
        debug("Error reading status response");
        $("#status").text("Error reading status response");
    }
    hideWaitDisplay(); // hide the wait message and animation
}

// Get the job status from the result XML
function getJobStatus(document) {	
	$xml = $(document);
	
    if ($xml.find("error") > 0)
       return "ERROR";
    var checkAgainMsText = $xml.find("checkAgainMs").text();
	if (checkAgainMsText.length > 0) {
	   checkAgainMs = checkAgainMsText + 0; // use the suggested "check again time"
	   return "BUSY";
	}
	if ($xml.find("stillCounting").text() == "true")
	   return "COUNTING";
	return "FINISHED";
}

// Reload the page to get the results.
function getResults() {
    location.reload();
}

// Update the total results counter (and other stats) after the search has completed.
function updateStats(backendUrl) {
    // We just want the stats, no actual results. Set max to 0.
    if (backendUrl.indexOf("max=") >= 0) {
        backendUrl = backendUrl.replace(/max=\d+/, "max=0");
    } else {
        backendUrl += "&max=0"; 
    }

    // Check stats
    logAjaxCall(backendUrl);
    $.get(backendUrl).done(function (data) {
        debug("Updating stats");
            
        $xml = $(data);
        var dur = $xml.find("searchTime").text();
        var hits = $xml.find("numberOfHits").text();
        var pages = Math.ceil(hits / $xml.find("requestedWindowSize").text());
            
        $("#duration").text(dur);
        $("#totalhits").text(hits);
        $("#totalpages").text(pages);
            
        var max = $.url().param('max');
        if (typeof max == 'undefined')
            max = 50;
            
        var start = $.url().param('start');
        if (typeof start == 'undefined')
            start = 0;
            
        updatePagination(pages, max, start);
    }).fail(function (jqXHR, textStatus) {
	    showAjaxFail(textStatus, $("#duration"));
        //alert("AJAX request " + backendUrl + " failed (cross-origin error?); textStatus = " + textStatus);
    });
}

// (Re)create the HTML for the pagination buttons
function updatePagination(totalPages, maxPerPage, startAtResult) {
	var currentPage = Math.ceil(startAtResult / maxPerPage);
	
	var startPage = Math.max(currentPage - 10, 0);
	var endPage = Math.min(currentPage + 10, totalPages);
	
	$(".pagebuttons").empty();
	
	if (currentPage == 0)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: 'Prev'})) );
	else
		$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: 'Prev', href: setUrlParameter('start', 0)})) );
	
	if (startPage > 0)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: '...'})) );
	
	for(var i = startPage; i < endPage; i++) {
		var page = i + 1;
		if (i == currentPage)
			$(".pagebuttons").append( $("<li/>", {class: 'active'}).append($("<a/>", {text: page, href: setUrlParameter('start', i * maxPerPage)})) );
		else 
			$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: page, href: setUrlParameter('start', i * maxPerPage)})) );
	}
	
	if (endPage < totalPages)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: '...'})) );
	
	if (currentPage == (totalPages - 1))
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: 'Next'})) );
	else
		$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: 'Next', href: setUrlParameter('start', (currentPage + 1) * maxPerPage)})) );
}

// Add parameter to URL or replace a parameter value in a URL 
function setUrlParameter(param, value) {
	var url = $.url(); // use purl to get the current URL parameters
	
	if (url.param(param)) {
		var fullUrl = url.attr('source');
		
		var splitUrl = fullUrl.split(param + "=", 2);
		
		var firstHalf = splitUrl[0];
		var secondHalf = splitUrl[1];
		secondHalf = secondHalf.substring(secondHalf.indexOf('&'));
		
		var newUrl = firstHalf + "&" + param + "=" + value + secondHalf;
		return newUrl;
	}
	
	return url.attr('source') + "&" + param + "=" + value + "&";
} 

// Wait for search to complete and show the results
function doResults(backendUrl) {
	checkStatus(backendUrl, loadResults);
}

// Wait for counting to complete and update stats
function doStats(backendUrl) {
	checkStatus(backendUrl, refreshStats);
}

// Debug logging
var doDebug = false;
function debug(string) {
	if (window.console && doDebug) {
		console.log(string);
	}
}
