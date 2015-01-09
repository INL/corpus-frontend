

function updateAvailableCorpora() {
	
	function updateCorporaLists(data) {
		var listItems = [];
		var listItemsPrivate = [];
		var indices = data['indices'];
		for (var i = 0; i < indices.length; i++) {
			var index = indices[i];
			var colonAt = index.indexOf(":");
			if (colonAt >= 0) {
				var shortName = index.substr(colonAt + 1);
				var listItem = "<li><a href='./:" + shortName + "/search'>" + shortName + "</a></li>";
				listItemsPrivate.push(listItem);
			} else {
				var listItem = "<li><a href='./" + index + "/search'>" + index + "</a></li>";
				listItems.push(listItem);
			}
		}
		$("#corpora").html(listItems.join(""));
		$("#corpora-private").html(listItemsPrivate.join(""));
		
		var showPublic = listItems.length > 0;
		var showPrivate = data['user']['loggedIn'] && listItemsPrivate.length > 0 || data['user']['canCreateIndex'];
		$("#header-private,#header-public").toggle(showPublic && showPrivate);
		$("#corpora-private").toggle(showPrivate);
		$("#create-corpus").toggle(data['user']['canCreateIndex']);
	}
	
	$.ajax(blsUrl, {
		"type": "GET",
		"accept": "application/json",
		"dataType": "json",
		"data": {
			"userid": "jan" // debug
		},
		"success": function (data) {
			updateCorporaLists(data);
		},
		"error": function (jqXHR, textStatus, errorThrown) {
			var data = jqXHR.responseXML;
			if (data && data['error']) {
				alert("Error for request: " + data['error']['message']);
			} else {
		    	alert("Error for request: " + textStatus + "; " + errorThrown);
			}
		},
	});
}

$(document).ready(function () {
	updateAvailableCorpora();
})
