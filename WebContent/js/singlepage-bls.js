
// class CorpusSearch
//----------------------------------------------------------------

var BLS = {};

(function () {
	
	var BLS_URL = "http://localhost:8080/blacklab-server/gysseling/";
	
	BLS.search = function (param, callback) {
		
		function filterQuery(name, value) {
			// TODO: escape double quotes in values with \
			if ($("#" + name + "-select").length > 0) {
				// Multiselect. Quote values and replace glue characters with spaces.
				var values = BLSEARCH.UTIL.safeSplit(value)
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
			"number": 50
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
		$("#debugInfo").html("BLS/" + url);
		
	    $.ajax({
	    	url: BLS_URL + url,
	    	dataType: "json",
	    	success: function (response) {
	    		callback(response);
	    	}
	    });
	};

})();

/*
var corpusOutput = {};

(function () {

	//----------------------------------------------------------------

	// Used for abbreviation and KWICs
	var ELLIPSIS = String.fromCharCode(8230);

	// Abbreviate a text
	//----------------------------------------------------------------
	function abbrev(text, maxChar) {
		if (text.length <= maxChar)
			return text;
		var spaceIndex = text.lastIndexOf(' ', maxChar);
		if (spaceIndex < 0)
			return text.substr(0, maxChar) + ELLIPSIS;
		return text.substr(0, spaceIndex) + " " + ELLIPSIS;
	}

	// Show an array of hits in a table
	//----------------------------------------------------------------
	corpusOutput.showHits = function (lemma, hits, docs) {

	    // Context of the hit is passed in arrays, per property
	    // (word/lemma/PoS/punct). Right now we only want to display the 
	    // words and punctuation. Join them together
	    function words(context, doPunctBefore, addPunctAfter) {
	    	var parts = [];
	    	var n = context['word'].length;
	    	for (var i = 0; i < n; i++) {
	    		if ((i == 0 && doPunctBefore) || i > 0)
	    			parts.push(context['punct'][i]);
	    		parts.push(context['word'][i]);
	    	}
	    	parts.push(addPunctAfter);
	        return parts.join("");
	    }

	    var html;
	    if (hits.length > 0) {
		    // Iterate over the hits.
		    // We'll add elements to the html array and join it later to produce our
		    // final HTML.
		    html = ["<table><tr><th class='kwic' colspan='2'>", messages['CONC_TH_KWIC'], " <a href='http://chn.inl.nl/'>CHN</a></th><th class='date'>", messages['CONC_TH_DATE'], "</th></tr>"];
		    $.each(hits, function (index, hit) {

		        // Add the document title and the hit information
		        var doc = docs[hit['docPid']];
		        var date = doc['witnessYear_from'];
		        var punctAfterLeft = hit['match']['word'].length > 0 ? hit['match']['punct'][0] : "";
		        var left = words(hit['left'], false, punctAfterLeft);
		        var match = words(hit['match'], false, "");
		        var right = words(hit['right'], true, "");
		        html.push("<tr><td class='left'>" + ELLIPSIS + " " + left +
		            "</td><td class='right'><b>" + match + "</b>" + right + " " + ELLIPSIS +
		            "</td><td>" + date + "</td></tr>");
		    });
		    html.push("</table>");
	    } else {
	    	html = ["<table><tr><td>", messages['CONC_NO_HITS'], "</td></tr></table>"];
	    }
	    corpusOutput.output(html.join("\n")); // Join lines and append to output area
		//corpusOutput.outputCorpusLink(lemma, hits.length > 0);
	};

	// Clear output area
	//----------------------------------------------------------------
	corpusOutput.clear = function () {
	    $('#corpusResultsArea').html('');
	};

	// Add HTML to the output area
	//----------------------------------------------------------------
	corpusOutput.output = function (addHtml) {
	    $('#corpusResultsArea').append(addHtml).append("\n");
	};

})();
*/
