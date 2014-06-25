// If an AJAX call failed (didn't return 200 OK), show it on
// the page and using an alert.
function showAjaxFail(textStatus, element) {
    $("#results .icon-spinner").hide();
    var msg = "AJAX request failed (cross-origin error?); textStatus = " + textStatus;
    var html = "<div class='error'>" + msg + "</div>";
    $(element).html(html);
    alert(msg);
}

// Log the URL and parameters of the AJAX call we're about to do
function logAjaxCall(url, parameters) {
    if (parameters.length == 0) {
        console.log(url);
        return;
    }
    paramStr = "";
    $(parameters).each(function (index) {
        if (paramStr.length > 0)
            paramStr += "&";
        paramStr += encodeURIComponent(index) + "=" + encodeURIComponent(parameters[index]);
    });
    console.log(url + "?" + paramStr);
}

function AjaxRetriever(webservice, webcall) {
	this.webservice = webservice;
	this.webcall = webcall;
}

AjaxRetriever.prototype.putAjaxResponse = function(element_id, parameters, append, xslSheet) {
	var myself = this;

	// check status
	logAjaxCall(this.webservice + this.webcall, parameters);
	$.ajax({
        type: "GET",
        url: this.webservice + this.webcall, 
        data: parameters, 
        cache: false
    }).done(function(data) {
		myself.addResponseToElement(data, element_id, append, xslSheet);
	}).fail(function(jqXHR, textStatus) {
	    showAjaxFail(textStatus, element_id);
	});
};

AjaxRetriever.prototype.addResponseToElement = function(data, element_id, append, xslSheet) {	
	var html = this.transform(data, xslSheet);

	if(!append)
		$(element_id).html('');
		
	$(element_id).append(html);	
};

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

