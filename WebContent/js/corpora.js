

function updateAvailableCorpora() {
	
	function updateCorporaLists(data) {
		var publicCorpora = [];
		var privateCorpora = [];
		var indices = data['indices'];
		for (var i = 0; i < indices.length; i++) {
			var index = indices[i];
			var fullName = index; // because we strip off the user part
			var colonAt = index.indexOf(":");
			var addToList = publicCorpora;
			var delLink = "", addLink = "";
			var searchLink = "<td><a class='icon' title='Search \"" + index + "\" corpus' href='./" + fullName + "/single'><i class='fa fa-search'></i></a></td>";
			if (colonAt >= 0) {
				index = index.substr(colonAt + 1);
				addToList = privateCorpora;
				delLink = "<td><a class='icon' title='Delete \"" + index + "\" corpus' href='#' onclick='deleteIndex(\"" + fullName + "\");'><i class='fa fa-remove'></i></a></td>";
				addLink = "<td><a class='icon' title='Add data to \"" + index + "\" corpus' href='#' onclick='showUploadForm(\"" + fullName + "\", \"" + index + "\");'><i class='fa fa-plus-square'></i></a></td>";
			}
			addToList.push("<tr><td class='corpusName'><a class='icon' title='Search \"" + index + "\" corpus' href='./" + fullName + "/single'>" + index + "</a></td>" + searchLink + addLink + delLink + "</tr>");
		}
		$("#corpora").html(publicCorpora.join(""));
		$("#corpora-private").html(privateCorpora.join(""));
		
		var showPublic = publicCorpora.length > 0;
		var showPrivate = data['user']['loggedIn'] && privateCorpora.length > 0 || data['user']['canCreateIndex'];
		$("#header-private,#header-public").toggle(showPublic && showPrivate);
		$("#corpora-private").toggle(showPrivate);
		$("#create-corpus").toggle(data['user']['canCreateIndex']);
	}
	
	$.ajax(blsUrl, {
		"type": "GET",
		"accept": "application/json",
		"dataType": "json",
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

function getUserId() {
	return "jan";
}

function showSuccess(msg) {
	$("#errorDiv").hide();
	$("#successMessage").html(msg);
	$("#successDiv").show();
}

function showError(msg) {
	$("#successDiv").hide();
	$("#errorMessage").html(msg).show();
	$("#errorDiv").show();
}

// Create an index in your private user area
function createIndex() {
	hideUploadForm();
	
	var shortName;
	shortName = prompt("Corpus name (letters and digits only):");
	if (shortName == null || shortName.length == 0)
		return;
	
	indexName = getUserId() + ":" + shortName;
	
	$.ajax(blsUrl + indexName, {
		"type": "PUT",
		"accept": "application/json",
		"dataType": "json",
		"success": function (data) {
			updateAvailableCorpora();
			showSuccess("Corpus \"" + shortName + "\" created.");
		},
		"error": function (jqXHR, textStatus, errorThrown) {
			var data = jqXHR.responseJSON;
			var msg;
			if (data && data['error'])
				msg = data['error']['message'];
			else
				msg = textStatus + "; " + errorThrown;
			showError("Could not create corpus \"" + shortName + "\": " + msg);
		},
	});
}

var uploadToCorpus = null;

function showUploadForm(indexName, shortName) {
	$("#uploadForm").show();
	$("#uploadCorpusName").html(shortName);
	uploadToCorpus = indexName;
}

// Delete an index from your private user area
function deleteIndex(indexName) {
	hideUploadForm();
	
	var shortName = indexName;
	var colonAt = shortName.indexOf(":");
	if (colonAt >= 0)
		shortName = shortName.substr(colonAt + 1);
	if (!confirm("You are about to delete \"" + shortName + "\"; this cannot be undone! Are you sure?"))
		return;
	
	$.ajax(blsUrl + indexName, {
		"type": "DELETE",
		"accept": "application/json",
		"dataType": "json",
		"success": function (data) {
			updateAvailableCorpora();
			showSuccess("Corpus \"" + shortName + "\" deleted.");
		},
		"error": function (jqXHR, textStatus, errorThrown) {
			var data = jqXHR.responseJSON;
			var msg;
			if (data && data['error'])
				msg = data['error']['message'];
			else
				msg = textStatus + "; " + errorThrown;
			showError("Could not delete corpus \"" + shortName + "\": " + msg);
		},
	});
}

function hideUploadForm() {
	var uploadButton = document.getElementById('uploadSubmit');
	uploadButton.innerHTML = 'Upload';
	uploadButton.removeAttribute('disabled');
	$("#uploadForm").hide();
}

function initFileUpload() {
	hideUploadForm();
	var form = document.getElementById('uploadForm');
	var fileSelect = document.getElementById('uploadFile');
	var uploadButton = document.getElementById('uploadSubmit');
	uploadButton.removeAttribute('disabled');
	form.onsubmit = function (event) {
		event.stopPropagation();
		event.preventDefault();

		// Update button text.
		uploadButton.innerHTML = 'Uploading...';
		uploadButton.disabled = 'disabled';
		
		// Get the selected file from the input.
		var file = fileSelect.files[0];
		
		// Create a new FormData object.
		var formData = new FormData();

		// Add the file to the request.
		formData.append('data', file, file.name);
	  
		// Set up the request.
		var xhr = new XMLHttpRequest();
		
		// Open the connection.
		var url = blsUrl + uploadToCorpus + "/docs/";
		xhr.open('POST', url, true);
		
		// Set up a handler for when the request finishes.
		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status <= 299) {
				// File(s) uploaded.
				hideUploadForm();
				showSuccess("Data uploaded succesfully and indexing.");
			} else {
				showError('An error occurred: ' + xhr.status + ' ' + xhr.statusText);
			}
		};
		
		// Send the Data.
		xhr.send(formData);
	}

}

$(document).ready(function () {
	updateAvailableCorpora();
	initFileUpload();
})
