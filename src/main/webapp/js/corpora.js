// (Private) corpora management page.
//
// Show a list of public and private corpora;
// Allows user to create and delete private corpora 
// and add data to them.

// (we place publicly accessible functions here)
var CORPORA = {};

// Per corpus, we store the document format (i.e. TEI, FoLiA, ...) here
var corpora = {};

// (avoid polluting the global namespace)
(function() {
	
	// When we retrieve the corpora list, we actually get
	// more than that. The whole server info JSON is stored here.
	// It includes the current user id, for example.
	var serverInfo = null;
	
	// Abbreviate a number, i.e. 3426 becomes 3,4K,
	// 2695798 becomes 2,6M, etc.
	// TODO: use a number formatting library for this..
	function abbrNumber(n) {
		if (n === undefined)
			return "";
		var unit = "";
		if (n >= 1e9) {
			n = Math.round(n / 1e8) / 10;
			unit = "G";
		} else if (n >= 1e6) {
			n = Math.round(n / 1e5) / 10;
			unit = "M";
		} else if (n >= 1e3) {
			n = Math.round(n / 1e2) / 10;
			unit = "K";
		}
		return String(n).replace(/\./, ",") + unit;
	}
	
	// Return only the date part of a date/time string,
	// and flip it around, e.g.:
	// "1970-02-01 00:00:00" becomes "01-02-1970"
	// TODO: use a date/time formatting library for this..
	function dateOnly(dateTimeString) {
		if (dateTimeString) {
			return dateTimeString.replace(/^(\d+)\-(\d+)\-(\d+) .*$/, "$3-$2-$1");
		}
		else {
			return "01-01-1970";
		}
	}
	
	// Request the list of available corpora and
	// update the corpora page with it.
	function refreshCorporaList(functionToCallAfterwards) {

		// Updates the lists of corpora HTML.
		// Called with the response data of the AJAX request.
		function updateCorporaLists(data) {
			serverInfo = data;
			$("#userId").text(getUserId());
			var publicCorpora = [];
			var privateCorpora = [];
			var indices = data.indices;
			for (var indexName in indices) {
				if (indices.hasOwnProperty(indexName)) {
					// Found an index. Determine how to display it.
					var index = corpora[indexName] = indices[indexName];
					index.name = indexName;
					index.documentFormat = index.documentFormat || "";

					// Can we search this index?
					// If not, we'll show the current index status after the name.
					var statusText = "";
					var canSearch = index.canSearch = true;
					if (index.status != "available") {
						statusText = " (" + index.status + ")";
						canSearch = false;
					}
					
					// What type of index is this, public or private?
					var isPrivateIndex = index.isPrivate = indexName.indexOf(":") >= 0;
					var addToList = isPrivateIndex ? privateCorpora : publicCorpora;
					
					// Show the add data / delete corpus icons?
					// (only for private corpora that are not being written to at the moment)
					var delIcon = "", addIcon = "";
					var isBusy = index.isBusy = index.status != 'available' && index.status != 'empty';
					dispName = index.displayName;
					if (isPrivateIndex && !isBusy) {
						delIcon = "<a class='icon fa fa-trash' title='Delete \"" + dispName + "\" corpus' " +
							"onclick='$(\"#confirm-delete-corpus\").data(\"indexName\", \"" + indexName + "\").modal(\"show\")' href='#'></a>";
						addIcon = "<a class='icon fa fa-plus-square' title='Add data to \"" + dispName + "\" corpus' " +
							"href='#' onclick='return CORPORA.showUploadForm(corpora[\"" + indexName + "\"]);'>" +
							"</a>";
					}
					var searchIcon = "<a class='icon disabled fa fa-search'></a>";
					
					// The index title and search icon (both clickable iff the index can be searched)
					var indexTitle = dispName;
					if (canSearch) {
						var url = "./" + indexName + "/search";
						searchIcon = "<a class='icon fa fa-search' title='Search \"" + dispName + 
							"\" corpus' href='"+ url + "'></a>";
						indexTitle = "<a title='Search \"" + dispName + "\" corpus' href='" + 
							url + "'>" + dispName + "</a>";
					}
					
					// Add HTML for this corpus to the appropriate list.
					var optColumns = "";
					if (isPrivateIndex) {
						optColumns = 
							"<td>" + friendlyDocFormat(index.documentFormat) + "</td>" +
							"<td>" + dateOnly(index.timeModified) + "</td>";
					}
					addToList.push("<tr>" +
						"<td class='corpus-name'>" + indexTitle + statusText + "</td>" +
						"<td>" + delIcon + "</td>" +
						"<td class='size'>" + abbrNumber(index.tokenCount) + "</td>" +
						optColumns +
						"<td>" + addIcon + "</td>" +
						"<td>" + searchIcon + "</td>" +
						"</tr>");
				}
			}
			
			// Put the HTML in the two lists.
			$("#corpora").html(publicCorpora.join(""));
			$("#corpora-private").html(privateCorpora.join(""));
			
			// Determine which headings and lists to show
			// (we only show the private list to people who are authorised to do something there,
			//  and we only show the public list if there are any public corpora on the server)
			var showPublic = publicCorpora.length > 0;
			var userLoggedIn = data.user.loggedIn;
			var showPrivate = userLoggedIn && (privateCorpora.length > 0 || data.user.canCreateIndex);
			$("#header-top").toggle(showPublic && showPrivate);
			$("#header-public, .corpora.public").toggle(showPublic);
			$("#header-private, #logged-in-as").toggle(showPrivate);
			$(".corpora.private").toggle(privateCorpora.length > 0);
			$("#create-corpus").toggle(data.user.canCreateIndex);
			
			if (!showPublic && !showPrivate) {
				showError("Sorry, no corpora are available, and you are not authorized to create a corpus. Please contact <a href='mailto:servicedesk@ivdnt.org'>servicedesk@ivdnt.org</a> if this is an error.");
			}
		}
		
		// Perform the AJAX request to get the list of corpora.
		$("#header-top").hide(); // hide "available corpora" heading
		$("#waitDisplay").show();
		$.ajax(CORPORA.blsUrl, {
			"type": "GET",
			"accept": "application/json",
			"dataType": "json",
			"success": function (data) {
				$("#header-top").show(); // show "available corpora" heading
				$("#waitDisplay").hide();
				updateCorporaLists(data);
				if (functionToCallAfterwards) {
					functionToCallAfterwards();
				}
			},
			"error": function (jqXHR, textStatus, errorThrown) {
				$("#waitDisplay").hide();
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + "; " + errorThrown;
				showError("Error retrieving corpus list: " + msg);
			},
		});
	}
	
	function friendlyDocFormat(format) {
		if (format.substr(0, 3).toLowerCase() == "tei") {
			return "TEI";
		}
		if (format.substr(0, 5).toLowerCase() == "folia") {
			return "FoLiA";
		}
		return format;
	}

	// Get the currently logged-in user, or the empty string if no user is logged in.
	function getUserId() {
		return serverInfo.user.loggedIn ? serverInfo.user.id : "";
	}

	// Show a success message.
	function showSuccess(msg, showInUploadDialog) {
		if (showInUploadDialog) {
			$("#uploadErrorDiv").hide();
			$("#uploadSuccessMessage").html(msg);
			$("#uploadSuccessDiv").show();
			$(".progress").hide();
		} else {
			$("#errorDiv").hide();
			$("#successMessage").html(msg);
			$("#successDiv").show();
		}
	}

	// Show an error message.
	function showError(msg, showInUploadDialog) {
		if (showInUploadDialog) {
			$("#uploadSuccessDiv").hide();
			$("#uploadErrorMessage").html(msg);
			$("#uploadErrorDiv").show();
			$(".progress").hide();
		} else {
			$("#successDiv").hide();
			$("#errorMessage").html(msg).show();
			$("#errorDiv").show();
		}
	}

	/**
	 *  Create the specified index in the private user area.
	 *  
	 *  @param displayName	string	Name to show for the index
	 *  @param shortName	string	Internal, technical name that uniquely identifies the index
	 *  @param format		string	Name of the format type for the documents in the index
	 */
	function createIndex(displayName, shortName, format) {
		if (shortName == null || shortName.length == 0)
			return;
		if (displayName == null)
			return;
		
		// Prefix the user name because it's a private index
		indexName = getUserId() + ":" + shortName;
		
		// Create the index.
		$("#waitDisplay").show();
		$.ajax(CORPORA.blsUrl, {
			"type": "POST",
			"accept": "application/json",
			"dataType": "json",
			"data": {
				"name": indexName,
				"display": displayName,
				"format": format
			},
			"success": function (data) {
				$("#waitDisplay").hide();
				refreshCorporaList();
				showSuccess("Corpus \"" + displayName + "\" created.");
			},
			"error": function (jqXHR, textStatus, errorThrown) {
				$("#waitDisplay").hide();
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + "; " + errorThrown;
				showError("Could not create corpus \"" + shortName + "\": " + msg);
			},
		});
	}

	// What corpus are we uploading data to?
	var uploadToCorpus = null;

	// Makes the upload form visible and sets the corpus we're uploading to
	CORPORA.showUploadForm = function (index) {
		if (uploadToCorpus == index) {
			$("#upload-file-dialog").modal("toggle");
		}
		else {
			$("#upload-file-dialog").modal("show");
		}
		$("#uploadCorpusName").text(index.displayName);
		$("#uploadFormat").text(friendlyDocFormat(index.documentFormat) + " ");
		uploadToCorpus = index;
		
		$("#uploadErrorDiv").hide();
		$("#uploadSuccessDiv").hide();
		$(".progress").hide();
		
		return false; // Cancel default link behaviour
	}

	// Delete an index from your private user area
	CORPORA.deleteIndex = function (index) {
		$("#waitDisplay").show();

		$.ajax(CORPORA.blsUrl + index.name, {
			"type": "DELETE",
			"accept": "application/json",
			"dataType": "json",
			"success": function (data) {
				$("#waitDisplay").hide();
				refreshCorporaList(function () {
					showSuccess("Corpus \"" + index.displayName + "\" deleted.");
				});
			},
			"error": function (jqXHR, textStatus, errorThrown) {
				$("#waitDisplay").hide();
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + "; " + errorThrown;
				showError("Could not delete corpus \"" + index.displayName + "\": " + msg);
			},
		});
		return false; // cancel link
	}

	// Initialise file uploading functionality.
	function initFileUpload() {
		// Disable file drops on the document
		$(document).bind("drop dragover", function (e) {
			e.preventDefault();
		});
		// Enable file drops on a specific 'zone'
	    $("#drop-zone").fileupload({
	    	dropZone: $("#drop-zone"),
	    	// This seems to have no effect!
	    	acceptFileTypes: /(\.|\/)(xml|zip|t?gz)$/i,
	    	maxFileSize: 4000000, // 4 MB
	        dataType: "json",
	        done: function(e, data) {
	            $(".progress .bar").text("'" + data.files[0].name + "': Done");
				refreshCorporaList(function () {
					showSuccess("Data added to \"" + uploadToCorpus.displayName + "\".", true);
		        	$("#upload-area").show();
		        	$("#uploadClose").show();
				});
	        },
	        fail: function(e, data) {
	        	var data = data.jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = data.textStatus + "; " + data.errorThrown;
				showError("Could not add data to \"" + uploadToCorpus.displayName + "\": " + msg, true);
	        	$("#upload-area").show();
	        	$("#uploadClose").show();
	        },
	        always: function(e, data) {
				$("#waitDisplay").hide();
				$(".fileinput-button").removeClass("hover");
	        },
		    progressall: function(e, data) {
		        var progress = parseInt(data.loaded / data.total * 100, 10);
		        var message = $(".progress .bar").text().replace(/(\([0-9]+%\) )?...$/, "(" + progress + "%) ...");
		        if (progress >= 99) {
		        	message = "Indexing data...";
		        }
		        $(".progress .bar")
		        	.css("width", progress + "%")
		        	.attr("aria-valuenow", progress);
	        	$(".progress .bar").text(message);
		    },
	        add: function(e, data) {
	        	$("#upload-area").hide();
	        	$("#uploadClose").hide();
	        	$("#waitDisplay").show();
	        	data.url = CORPORA.blsUrl + uploadToCorpus.name + "/docs/";
	        	data.data = new FormData();
   		        data.data.append("data", data.files[0], data.files[0].name);
   		        $(".progress").show();
   		        $("#uploadSuccessDiv").hide();
   		        $("#uploadErrorDiv").hide();
	            data.context = $(".progress .bar").css("width", "0%").attr("aria-valuenow", 0).
	            	text("Uploading '" + data.files[0].name + "' ...");
	            data.submit();
	        },
	        dragover: function(e, data) {
	        	$(".fileinput-button").addClass("hover");
	        }
	    });
	    $('#drop-zone').bind("dragleave dragend", function(e) {
			e.preventDefault();
	    	$(".fileinput-button").removeClass("hover");
	    });
	}

	function initNewCorpus() {
		var $newCorpusModal = $("#new-corpus-modal");
		var $corpusNameInput = $("#corpus_name");
		var $corpusFormatSelect = $("#corpus_document_type");
		var saveButtonClass = ".btn-primary";
		
		$newCorpusModal.on("show.bs.modal", function(event) {
			$(saveButtonClass, $newCorpusModal).prop("disabled", true);
			$corpusNameInput.val("");
			$corpusFormatSelect.prop("selectedIndex", 0);
		});
		$newCorpusModal.on("shown.bs.modal", function(event) {
			$corpusNameInput[0].focus();
		});
		$corpusNameInput.on("change, input", function(event) {
			$(saveButtonClass, $newCorpusModal).prop("disabled", $(this).val().length <= 2);
		});
		// Enable submit through pressing the 'enter' key while a form element has the focus
		$("input, select", $newCorpusModal).on("keydown", function(event) {
			if (event.keyCode == 13) {
				event.preventDefault();
				if (!$(saveButtonClass, $newCorpusModal).prop("disabled")) {
					$(saveButtonClass, $newCorpusModal).click();
				}
			}
		});
		$(saveButtonClass, $newCorpusModal).click(function(event) {
			var corpusName = $corpusNameInput.val();
			var format = $corpusFormatSelect.val();
			$newCorpusModal.modal("hide");
			createIndex(corpusName, generateShortName(corpusName), format);
		});
	}

	function initDeleteCorpus() {
		var deleteCorpusModal = $("#confirm-delete-corpus");
		var corpusName = $("#corpus-delete-name");
		var deleteButtonClass = ".btn-primary";

		deleteCorpusModal.on("show.bs.modal", function(event) {
			var indexName = deleteCorpusModal.data("indexName");
			corpusName.text(corpora[indexName].displayName);
		});
		$(deleteButtonClass, deleteCorpusModal).click(function(event) {
			deleteCorpusModal.modal("hide");
			CORPORA.deleteIndex(corpora[deleteCorpusModal.data("indexName")]);
		});
	}

	function generateShortName(name) {
		return name.replace(/[^\w]/g, "-").replace(/^[_\d]+/, "");
	}

	$(document).ready(function () {
		CORPORA.blsUrl = $(".contentbox").data("blsUrl");

		// Get the list of corpora.
		refreshCorporaList();
		
		// Wire up the AJAX uploading functionality.
		initFileUpload();
		
		// Wire up the "new corpus" and "delete corpus" buttons.
		initNewCorpus();
		initDeleteCorpus();
	});
})();

