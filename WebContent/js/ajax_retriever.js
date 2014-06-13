// AJAX-related functions

// Constructor: takes the base URL and the operation we want to carry out
function AjaxRetriever(webservice, webcall) {
	this.webservice = webservice;
	this.webcall = webcall;
}

// Perform AJAX call, transform response XML to HTML and add to the page
AjaxRetriever.prototype.putAjaxResponse = function(element_id, parameters, append, xslSheet) {
	var myself = this;

	// check status
	$.ajax({
        type: "GET",
        dataType: "xml",
        url: this.webservice + this.webcall, 
        data: parameters, 
        cache: false
    }).done(function(data) {
		myself.addResponseToElement(data, element_id, append, xslSheet);
	}).fail(function(jqXHR, textStatus) {
        alert("AJAX request failed (cross-origin error?); textStatus = " + textStatus);
	});
};

// Transform response XML and add to / replace element content
AjaxRetriever.prototype.addResponseToElement = function(data, element_id, append, xslSheet) {	
	var html = this.transform(data, xslSheet);

	if(!append)
		$(element_id).html('');
		
	$(element_id).append(html);	
};

// Transform XML using XSLT
AjaxRetriever.prototype.transform = function(xml, xslSheet) {	
	// get stylesheet
	xhttp = new XMLHttpRequest();
	xhttp.open("GET", xslSheet, false);
	xhttp.send("");
	
	var parser = new DOMParser();
	var sheet = parser.parseFromString( xhttp.responseText, "text/xml");
	
	// apply translation
	var result = "";
	if(window.ActiveXObject) {
		// Internet Explorer has to be the special child of the class -_-
		sheet = new ActiveXObject("Microsoft.XMLDOM");
		sheet.async = false;
		sheet.loadXML(xhttp.responseText);
		result = xml.transformNode(sheet);
	} else {
		var processor = new XSLTProcessor();
		processor.importStylesheet(sheet);
		result = processor.transformToFragment(xml, document);
	}
	
	return result;
};







