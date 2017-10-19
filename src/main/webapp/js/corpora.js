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
			$('[data-autoupdate="userId"]').text(getUserId());
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
					var dispName = index.displayName;
					if (isPrivateIndex && !isBusy) {
						delIcon = "<a class='icon fa fa-trash' title='Delete \"" + dispName + "\" corpus' " +
							"onclick=\"CORPORA.deleteCorpus('" + indexName + "')\" href='#'></a>";
						addIcon = "<a class='icon fa fa-plus-square' title='Add data to \"" + dispName + "\" corpus' " +
							"href='#' onclick='return CORPORA.showUploadForm(corpora[\"" + indexName + "\"]);'>" +
							"</a>";
					}
					
					// The index title and search icon (both clickable iff the index can be searched)
					var searchIcon = "<a class='icon disabled fa fa-search'></a>";
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
	
			// Determine which headings and lists to show
			// (we only show the private list to people who are authorised to do something there,
			//  and we only show the public list if there are any public corpora on the server)
			var showPublic = publicCorpora.length > 0;
			var showPrivate = data.user.loggedIn && (privateCorpora.length > 0 || data.user.canCreateIndex);

			// Put the HTML in the two lists.
			$("#corpora").html(publicCorpora.join(""));
			$("#corpora-private").html(privateCorpora.join(""));

			// Show/hide elements
			$('#corpora-all-container').toggle(showPublic || showPrivate);
			$('#corpora-public-container').toggle(showPublic);
			$('#corpora-private-container').toggle(showPrivate);
			$("#create-corpus").toggle(data.user.canCreateIndex);
			
			if (!(showPublic || showPrivate)) {
				showError("Sorry, no corpora are available, and you are not authorized to create a corpus. Please contact <a href='mailto:servicedesk@ivdnt.org'>servicedesk@ivdnt.org</a> if this is an error.");
			}
		}
		
		// Perform the AJAX request to get the list of corpora.
		$("#waitDisplay").show();
		$.ajax(CORPORA.blsUrl, {
			"type": "GET",
			"accept": "application/json",
			"dataType": "json",
			"success": function (data) {
				updateCorporaLists(data);
				if (functionToCallAfterwards) {
					functionToCallAfterwards();
				}
			},
			"error": function (jqXHR, textStatus, errorThrown) {
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + "; " + errorThrown;
				showError("Error retrieving corpus list: " + msg);
			},
			complete: function() {
				$('#waitDisplay').hide();
			}
		});
	}

	function refreshFormatList() {		
		$.ajax(CORPORA.blsUrl + "/input-formats/", {
			type: "GET",
			accept: "application/json",
			dataType: "json",
			success: function(data) {
				var $select = $('select[data-autoupdate="format"]');
				var $tbody = $('table[data-autoupdate="format"]').children('tbody');

				var $defaultFormatOptGroup = $('<optgroup label="Presets"></optgroup>');
				var $userFormatOptGroup = $('<optgroup label="' + data.user.id + '"></optgroup>');
				var $nonConfigBasedOptions = $();

				$select.empty();
				$tbody.empty();
				$.each(data.supportedInputFormats, function(formatId, format) {
					// Strip any usernames from the format id to extract a short name
					var isUserFormat = formatId.indexOf(data.user.id) !== -1;
					var shortName = isUserFormat ? formatId.substr(formatId.indexOf(data.user.id) + data.user.id.length + 1) : formatId;
					

					// we have title, >something?< and data-content
					var $option = $('<option title="' + (format.description || format.displayName) + '" value="' + formatId + '">' + shortName + ' - ' + format.displayName + '</option>');
					
					var $tr = $([
					'<tr>',
						'<td>', shortName, '</td>',
						'<td>', format.displayName, '</td>',
						'<td><a class="fa fa-trash" data-format-operation="delete" data-format-id="'+formatId+'" title=\'Delete format "'+shortName+'"\' href="javascript:void(0)"></a></td>',
						'<td></td>',
						// TODO
						//'<td><a class="fa fa-pencil" data-format-operation="edit" label="Edit" href="javascript:void(0)"></a></td>',
					'</tr>'].join(""));
				
					if (formatId.indexOf(data.user.id) === 0) {
						$userFormatOptGroup.append($option);
						$tbody.append($tr);
					} else {
						if (format.configurationBased)
							$defaultFormatOptGroup.append($option);
						else 
							$nonConfigBasedOptions = $nonConfigBasedOptions.add($option);
					}
				});

				$select.append($defaultFormatOptGroup).append($userFormatOptGroup)
				.filter(":not(#format_preset)").children('optgroup:nth-child(1)').append($nonConfigBasedOptions);
				$select.selectpicker('refresh');

				$('#formats-all-container').toggle(data.user.loggedIn && data.user.canCreateIndex);
			},
			error: function(jqXHR, textStatus, errorThrown) {
				showError("Error retrieving input formats.");
			}
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
		var indexName = getUserId() + ":" + shortName;
		
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
			maxFileSize: 40000000, // 4 MB
			dataType: "json",
			done: function(e, data) {
				$(".progress .progress-bar").text("'" + data.files[0].name + "': Done");
				refreshCorporaList(function () {
					showSuccess("Data added to \"" + uploadToCorpus.displayName + "\".", true);
					$("#upload-area").show();
					$("#uploadClose").show();
				});
			},
			fail: function(e, data) {
				data = data.jqXHR.responseJSON || data;
				var msg;
				if (data.error)
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
				var message = $(".progress .progress-bar").text().replace(/(\([0-9]+%\) )?...$/, "(" + progress + "%) ...");
				if (progress >= 99) {
					message = "Indexing data...";
				}
				$(".progress .progress-bar")
					.css("width", progress + "%")
					.attr("aria-valuenow", progress);
				$(".progress .progress-bar").text(message);
			},
			add: function(e, data) {
				$("#upload-area").hide();
				$("#uploadClose").hide();
				$("#waitDisplay").show();
				data.url = CORPORA.blsUrl + uploadToCorpus.name + "/docs/";
				data.data = new FormData();
				data.data.append("data", data.files[0]/*, data.files[0].name*/);
				$(".progress").show();
				$("#uploadSuccessDiv").hide();
				$("#uploadErrorDiv").hide();
				data.context = $(".progress .progress-bar").css("width", "0%").attr("aria-valuenow", 0).
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


	/**
	 * Show a dialog with custom message, title, and confirm button html
	 * Call a callback, only if the confirm button is pressed. 
	 * 
	 * @param {any} title 
	 * @param {any} message 
	 * @param {any} buttontext 
	 * @param {any} fnCallback 
	 */
	var confirmDialog = (function() { 
		var $modal = $('#modal-confirm');
		var $confirmButton = $modal.find("#modal-confirm-confirm");
		var $title = $modal.find('#modal-confirm-title');
		var $message = $modal.find('#modal-confirm-message');
		
		return function(title, message, buttontext, fnCallback) {
			$title.html(title);
			$message.html(message);
			$confirmButton.html(buttontext);

			$modal.modal('show');
			$modal.one('hide.bs.modal', function() {
				if (document.activeElement === $confirmButton[0])
					fnCallback();
			});
		}
	})();


	CORPORA.deleteCorpus = function(indexName) {
		confirmDialog(
			"Delete format?", 
			"You are about to delete corpus <i>" + indexName + "<i>. This cannot be undone! <br>Are you sure?",
			"Delete",
			CORPORA.deleteIndex.bind(null,  corpora[indexName]));
	}

	function generateShortName(name) {
		return name.replace(/[^\w]/g, "-").replace(/^[_\d]+/, "");
	}

	function initNewFormat() {
		
		var $modal = $('#new-format-modal');

		var $fileInput = $('#format_file');
		var $presetSelect = $('#format_preset');
		var $downloadButton = $('#format_download');

		var $formatName = $("#format_name");
		var $formatType = $('#format_type');
		var editor = CodeMirror.fromTextArea($('#format_editor')[0], {
			mode: "yaml",
			lineNumbers: true,
			matchBrackets: true,
			
			viewportMargin: 100 // render 100 lines above and below the visible editor window
		});

		var $confirmButton = $('#format_save');
		

		function showFormatError(text) {
			$('#format_error').text(text).show();
		}
		function hideFormatError() {
			$('#format_error').hide();
		}

		function uploadFormat(file) {
			var formData = new FormData();
			formData.append("data", file, file.name);

			$.ajax(CORPORA.blsUrl + "/input-formats/", {
				data: formData,
				processData: false,
				contentType: false,
				type: 'POST',
				accept: 'application/javascript',
				dataType: 'json',
				success: function (data) {
					$modal.modal('hide');
					$formatName.val("");
					editor.setValue("");

					refreshFormatList();
					showSuccess(data.status.message);
				},
				error: function (jqXHR, textStatus, errorThrown) {
					showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
				}
			});
		}

		$modal.on('shown.bs.modal', function() {
			// Required to fix line-number display width being calculated incorrectly
			// (something to do with initializing the editor when the element is invisible or has width 0)
			editor.refresh();
		});

		$modal.on('hidden.bs.modal', function() {
			hideFormatError();
		});
		
		$formatType.on('change', function() {
			var newMode = $(this).selectpicker('val');
			if (newMode === "json") {
				editor.setOption("mode", {
					name: 'javascript',
					json: true
				});
			} else {
				editor.setOption('mode', newMode);
			}
		});

		$fileInput.on('change', function() {
			if (this.files[0] != null) {
				var file = this.files[0];
				var fr = new FileReader();
				
				fr.onload = function() {
					editor.setValue(fr.result);
				}
				fr.readAsText(file);
			}
		});

		$downloadButton.on('click', function() {
			var presetName = $presetSelect.selectpicker('val');

			$.ajax(CORPORA.blsUrl + "/input-formats/" + presetName,  {
				"type": "GET",
				"accept": "application/javascript",
				"dataType": "json",
				"success": function (data) {
					var configFileType = data.configFileType.toLowerCase();
					if (configFileType === "yml")
						configFileType = "yaml";
					
					$formatType.selectpicker('val', configFileType);
					$formatType.trigger('change');
					editor.setValue(data.configFile);
				},
				"error": function (jqXHR, textStatus, errorThrown) {
					showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
				},
			});
		});

		$confirmButton.on('click', function() {
			if (!$formatName.val()) {
				showFormatError("Please enter a name.");
				return;
			}
			
			var fileContents = editor.getValue();
			var fileName = $formatName.val() + "." + $formatType.selectpicker("val");
			
			// IE11 does not support File constructor.
			//var file = new File([new Blob([fileContents])], fileName);
			var file = new Blob([fileContents]);
			file.name = fileName;
			file.lastModifiedDate = new Date();			
			uploadFormat(file);
		});
	}

	function initDeleteFormat() {
		
		$('table[data-autoupdate="format"]').on('click', '[data-format-operation="delete"]', function(event) {
			event.preventDefault();
	
			var $tr = $(this).closest('tr');
			var formatId = $(this).data('format-id');
			
			confirmDialog(
				"Delete import format?",
				"You are about to delete the import format <i>" + formatId + "</i>.<br>Are you sure?",
				"Delete", 
				function() {
					$.ajax(CORPORA.blsUrl + "/input-formats/" + formatId, {
						type: "DELETE",
						accept: "application/javascript",
						dataType: "json",
						success: function(data) {
							showSuccess(data.status.message);
							refreshFormatList();
						},
						error: function(jqXHR) {
							showError(jqXHR.responseJSON.error.message);
						}
					});
				}
			);		
		});

	}

	$(document).ready(function () {
		CORPORA.blsUrl = $(".contentbox").data("blsUrl");
		
		
		// Get the list of corpora.
		refreshCorporaList();
		refreshFormatList();
		
		// Wire up the AJAX uploading functionality.
		initFileUpload();
		
		// Wire up the "new corpus" and "delete corpus" buttons.
		initNewCorpus();
		
		initNewFormat();
		initDeleteFormat();
	});
})();

