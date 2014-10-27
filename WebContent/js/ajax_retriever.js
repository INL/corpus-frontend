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
    if (!parameters) {
        console.log(url);
        return;
    }
    paramStr = "";
    $.each(parameters, function (key, value) {
        if (paramStr.length > 0)
            paramStr += "&";
        paramStr += encodeURIComponent(key) + "=" + encodeURIComponent(value);
    });
    console.log(url + "?" + paramStr);
}

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
	logAjaxCall(this.webservice + this.webcall, parameters);
	$.ajax({
        type: "GET",
        dataType: "xml",
        url: this.webservice + this.webcall, 
        data: parameters, 
        cache: false
    }).done(function(data) {
    	var errorElements = $(data).find("error"); 
    	if (errorElements.length > 0) {
    		var message = errorElements.find("message").text();
    		alert("ERROR: " + message);
    		return;
    	}
    		
		myself.addResponseToElement(data, element_id, append, xslSheet);
	}).fail(function(jqXHR, textStatus) {
	    showAjaxFail(textStatus, element_id);
	});
};

// Transform response XML and add to / replace element content
AjaxRetriever.prototype.addResponseToElement = function(xmlResponse, element_id, append, xslSheetUrl) {
	this.loadXslSheet(xslSheetUrl, function (xslSheet) {
		var html = transformToHtmlText(xmlResponse, xslSheet);
		if(!append)
			$(element_id).html('');
		$(element_id).append(html);	
	});
};

// FROM: http://stackoverflow.com/questions/12149410/object-doesnt-support-property-or-method-transformnode-in-internet-explorer-1
// (By Stack Overflow user "The Alpha", License: CC-BY-SA 3.0)
function transformToHtmlText(xmlDoc, xsltDoc) {
    if (typeof (XSLTProcessor) != "undefined") { // FF, Safari, Chrome etc
        var xsltProcessor = new XSLTProcessor();
        xsltProcessor.importStylesheet(xsltDoc);
        var xmlFragment = xsltProcessor.transformToFragment(xmlDoc, document);
        return xmlFragment;
    }

    if (typeof (xmlDoc.transformNode) != "undefined") { // IE6, IE7, IE8
        return xmlDoc.transformNode(xsltDoc);
    }
    else {
        try { // IE9 and grater
        	// Disabled check because IE11 reports ActiveXObject as undefined
        	// (but we still need it to do client-side XSLT..)
            //if (window.ActiveXObject) {
                var xslt = new ActiveXObject("Msxml2.XSLTemplate");
                var xslDoc = new ActiveXObject("Msxml2.FreeThreadedDOMDocument");
                xslDoc.loadXML(xsltDoc.xml);
                xslt.stylesheet = xslDoc;
                var xslProc = xslt.createProcessor();
                xslProc.input = xmlDoc;
                xslProc.transform();
                return xslProc.output;
            //}
        }
        catch (e) {
        	alert("Exception while doing XSLT transform: " + e.message);
            //alert("The type [XSLTProcessor] and the function [XmlDocument.transformNode] are not supported by this browser, can't transform XML document to HTML string!");
            return null;
        }
    }
}

AjaxRetriever.prototype.loadXslSheet = function(xslSheetUrl, successFunc) {
	
	var result;
	if (typeof XMLHttpRequest !== 'undefined') {
		// Firefox, Chrome and newer IE versions
	    var xhr = new XMLHttpRequest();
	    xhr.open("GET", xslSheetUrl, false);
	    // request MSXML responseXML for IE
	    try { xhr.responseType = 'msxml-document'; } catch(e) { }
	    xhr.send();
	    result = xhr.responseXML;
	} else {
		// Older IE versions: use ActiveXObject
	    try {
	        var xhr = new ActiveXObject('Msxml2.XMLHTTP.3.0');
	        xhr.open('GET', xslSheetUrl, false);
	        xhr.send();
	        result = xhr.responseXML;
	    }
	    catch (e) {
	        // handle case that neither XMLHttpRequest nor MSXML is supported
	        alert("Could not load XSL sheet: " + e.message);
	    }
	}
	
	var errorElements = $(result).find("error"); 
	if (errorElements.length > 0) {
		var message = errorElements.find("message").text();
		alert("ERROR: " + message);
		return;
	}
	successFunc(result);
}

