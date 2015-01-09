
// class CorpusSearch
//----------------------------------------------------------------

var BLS = {};

// moved to single.vm
//var BLS_URL = "http://localhost:8080/blacklab-server/gysseling/";

(function () {
	
	BLS.search = function (param, successFunc, failFunc) {

		function filterQuery(name, value) {
			// TODO: escape double quotes in values with \
			if ($("#" + name + "-select").length > 0) {
				// Multiselect. Quote values and replace glue characters with spaces.
				var values = SINGLEPAGE.safeSplit(value)
				if (values.length > 1)
					return name + ":(\"" + values.join("\" \"") + "\")";
			}
			if (value.match(/ /))
				return name + ":\"" + value + "\"";
			else
				return name + ":" + value;
		}
		
		function getPattern(wordProp) {
			var tokens = [];
			for (key in wordProp) {
				if (wordProp.hasOwnProperty(key)) {
					var propTokens = wordProp[key].split(/\s+/);
					for (var i = 0; i < propTokens.length; i++) {
						if (!tokens[i])
							tokens[i] = {};
						if (propTokens[i] == "*" || propTokens[i] == ".*" || propTokens[i] == "[]")
							continue;
						tokens[i][key] = propTokens[i];
					}
				}
			}
			var cql = "";
			for (var i = 0; i < tokens.length; i++) {
				var token = "";
				var wordOnly = true;
				var word = "";
				for (key in tokens[i]) {
					if (tokens[i].hasOwnProperty(key)) {
						if (token.length > 0)
							token += " & "
						token += key + "=\"" + tokens[i][key] + "\"";
						if (key != "word")
							wordOnly = false;
						else
							word = tokens[i][key];
					}
				}
				if (cql.length > 0)
					cql += " ";
				if (token.length > 0) {
					if (wordOnly && word.length > 0)
						cql += "\"" + word + "\"";
					else
						cql += "[" + token + "]"
				} else {
					cql += "[]";
				}
			}
			return cql;
		}
		
		var blsParam = {
			"number": 50 // default value
		};
		var filter = "";
		var wordProp = {};
		var operation = "hits";
		for (key in param) {
			if (param.hasOwnProperty(key)) {
				var value = param[key];
				if (key == "view" && value == "docs") {
					operation = "docs";
				} else if (key.charAt(0) == '_') {
					// Metadata. Translate to BLS syntax.
					if (filter.length > 0)
						filter += " ";
					filter += filterQuery(key.substr(1), value);
				} else if ($("#" + key + "_text").length > 0) {
					// Word property. Use to construct BLS pattern later.
					wordProp[key] = value;
				} else {
					// Something else. For now, assume we can just pass it to BLS.
					blsParam[key] = value;
				}
			}
		}
		var patt = getPattern(wordProp);
		if (patt.length > 0)
			blsParam["patt"] = patt;
		
		if (!blsParam["patt"] || blsParam["patt"].length == 0) {
			if (filter.length == 0) {
				failFunc({
					"code": "NO_PATTERN_GIVEN ",
					"message": "Text search pattern required."
				});
			}
			operation = "docs";
		}
		if (filter.length > 0)
			blsParam["filter"] = filter;
		
		var url = "";
		for (key in blsParam) {
			if (blsParam.hasOwnProperty(key)) {
				var value = blsParam[key];
				if (url.length > 0)
					url += "&";
				url += key + "=" + encodeURIComponent(value);
			}
		}
		var url = operation + "?" + decodeURIComponent(url);
		//$("#debugInfo").html("BLS/" + url);
		
	    $.ajax({
	    	url: BLS_URL + url,
	    	dataType: "json",
	    	success: function (response) {
	    		successFunc(response);
	    	},
	    	error: function (jqXHR, textStatus, errorThrown) {
	    		var data = jqXHR.responseJSON;
				if (data && data['error']) {
					failFunc(data['error']);
				} else {
					failFunc({
	    				"code": "WEBSERVICE_ERROR",
	    				"message": "Error contacting webservice: " + textStatus + "; " + errorThrown
	    			});
				}
	    	}
	    });
	};

})();
