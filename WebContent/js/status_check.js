function checkStatus(webservice, key, callbackMethod) {
	// check status
	var parameters = {id: key};
    logAjaxCall(this.webservice + "status", parameters);
	$.ajax({
	    type: "GET", 
	    url: webservice + "status", 
	    data: parameters, 
	    cache: false
	}).done(function (data) {
		callbackMethod(webservice, key, data);
	})
	.fail(function (jqXHR, textStatus) {
	    showAjaxFail(textStatus, $("#status"));
    });
}

function loadResults(webservice, key, data) {
	var status = getJobStatus(data);
	
	$("#status").text(status + "...");
	debug("Status: " + status);
	
	if(status == "" || status.substring(0, 7) == "ABORTED" || status.substring(0, 6) == "No job")
		showLoadingError();
	else if(status == "COUNTING" || status == "FINISHED")
		getResults(key);
	else 
		setTimeout( function() {checkStatus(webservice, key, loadResults);}, 1000); // check again 1 second from now		
}

function refreshStats(webservice, key, data) {
	var status = getJobStatus(data);
	
	debug("Status: " + status);
	
	if(status == "" || status.substring(0,6) == "No job")
		showLoadingError();
	else if(status == "FINISHED")
		updateStats(webservice, key);
	else
		setTimeout( function() {checkStatus(webservice, key, refreshStats);}, 1000); // check again 1 second from now
		
}

function showLoadingError() {
    $("#results .icon-spinner").hide();
	debug("showLoadingError(): error reading status response");
	$("#status").text("Your search produced an error. Please contact servicedesk@inl.nl.");
}

function getJobStatus(document) {	
	$xml = $(document);
	
	return $xml.find("JobStatus").text();
}

function getResults(key) {
	window.location = window.location + "&key=" + key;
}

function updateStats(webservice, key) {
	var status = "";
	var parameters = {id: key};
    logAjaxCall(webservice + "jobstats", parameters);
	$.ajax({
	    type: "GET",
	    url: webservice + "jobstats",
	    data: parameters,
	    cache: false
	}).done(function(data) {
		debug("Updating stats");
			
		$xml = $(data);
		var dur = $xml.find("Duration").text();
		var hits = $xml.find("TotalHits").text();
		var pages = $xml.find("TotalPages").text();
			
		$("#duration").text(dur);
		$("#totalhits").text(hits);
		$("#totalpages").text(pages);
			
		var max = $.url().param('max');
		if(typeof max == 'undefined')
			max = 50;
			
		var start = $.url().param('start');
		if(typeof start == 'undefined')
			start = 0;
			
		updatePagination(pages, max, start);
	}).fail(function (jqXHR, textStatus) {
	    showAjaxFail(textStatus, $("#duration"));
    });
}

function updatePagination(totalPages, maxPerPage, startAtResult) {
	var currentPage = Math.ceil(startAtResult / maxPerPage);
	
	var startPage = Math.max(currentPage - 10, 0);
	var endPage = Math.min(currentPage + 10, totalPages);
	
	$(".pagebuttons").empty();
	
	if(currentPage == 0)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: 'Prev'})) );
	else
		$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: 'Prev', href: setUrlParameter('start', 0)})) );
	
	if(startPage > 0)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: '...'})) );
	
	for(var i = startPage; i < endPage; i++) {
		var page = i + 1;
		if(i == currentPage)
			$(".pagebuttons").append( $("<li/>", {class: 'active'}).append($("<a/>", {text: page, href: setUrlParameter('start', i * maxPerPage)})) );
		else 
			$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: page, href: setUrlParameter('start', i * maxPerPage)})) );
	}
	
	if(endPage < totalPages)
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: '...'})) );
	
	if(currentPage == (totalPages - 1))
		$(".pagebuttons").append( $("<li/>", {class: 'disabled'}).append($("<a/>", {text: 'Next'})) );
	else
		$(".pagebuttons").append( $("<li/>").append($("<a/>", {text: 'Next', href: setUrlParameter('start', (currentPage + 1) * maxPerPage)})) );
}

function setUrlParameter(param, value) {
	var url = $.url();
	
	if(url.param(param)) {
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

function doResults(webservice, key) {
	checkStatus(webservice, key, loadResults);
}

function doStats(webservice, key) {
	checkStatus(webservice, key, refreshStats);
}

var doDebug = false;
function debug(string) {
	if(window.console && doDebug) {
		console.log(string);
	}
}