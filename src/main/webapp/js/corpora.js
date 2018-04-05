/* global CodeMirror */

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
	'use strict';
	
	// When we retrieve the corpora list, we actually get
	// more than that. The whole server info JSON is stored here.
	// It includes the current user id, for example.
	var serverInfo = null;
	
	// Abbreviate a number, i.e. 3426 becomes 3,4K,
	// 2695798 becomes 2,6M, etc.
	// TODO: use a number formatting library for this..
	function abbrNumber(n) {
		if (n === undefined)
			return '';
		var unit = '';
		if (n >= 1e9) {
			n = Math.round(n / 1e8) / 10;
			unit = 'G';
		} else if (n >= 1e6) {
			n = Math.round(n / 1e5) / 10;
			unit = 'M';
		} else if (n >= 1e3) {
			n = Math.round(n / 1e2) / 10;
			unit = 'K';
		}
		return String(n).replace(/\./, ',') + unit;
	}
	
	// Return only the date part of a date/time string,
	// and flip it around, e.g.:
	// "1970-02-01 00:00:00" becomes "01-02-1970"
	// TODO: use a date/time formatting library for this..
	function dateOnly(dateTimeString) {
		if (dateTimeString) {
			return dateTimeString.replace(/^(\d+)-(\d+)-(\d+) .*$/, '$3-$2-$1');
		}
		else {
			return '01-01-1970';
		}
	}

	/**
	 * Keep requesting the status of the current index until it's no longer indexing.
	 * The update handler will be called periodically while the status is "indexing", and then once more when the status has changed to something other than "indexing".
	 * 
	 * @param fnUpdateHandler called with the up-to-date index data
	 * @param fnErrorHander called with the error string
	 */
	function refreshIndexStatusWhileIndexing(indexId, fnUpdateHandler, fnErrorHandler) {
		var statusUrl = CORPORA.blsUrl + indexId + '/status/';
		
		var timeoutHandle;
		
		function success(index) {
			normalizeIndexData(indexId, index);
			fnUpdateHandler(index);

			if (index.status !== 'indexing')
				clearTimeout(timeoutHandle);
			else
				setTimeout(run, 2000);
		}

		function error(jqXHR, textStatus, errorThrown) {
			var indexName = indexId.indexOf(':') !== -1 ? indexId.substr(indexId.indexOf(':')+1) : indexId;
			
			var data = jqXHR.responseJSON;
			var msg;
			if (data && data.error)
				msg = data.error.message;
			else
				msg = textStatus + '; ' + errorThrown;
			
			fnErrorHandler('Error retrieving status for corpus \''+indexName+'\': ' + msg);
			clearTimeout(timeoutHandle);
		}

		
		function run() {
			$.ajax(statusUrl, {
				'type': 'GET',
				'accept': 'application/json',
				'dataType': 'json',
				'success': success,
				'error': error
			});
		}

		timeoutHandle = setTimeout(run, 2000);
	}
	
	/**
	 * Add some calculated properties to the index object (such as if it's a private index) and normalize some optional data to empty strings if missing.
	 * 
	 * @param {String} indexId full id of the index, including username portion (if applicable)
	 * @param {Object} index the index json object as received from blacklab-server
	 */
	function normalizeIndexData(indexId, index) {
		index.id = indexId;
		index.documentFormat = index.documentFormat || '';
		index.canSearch = index.status === 'available';
		index.isBusy = index.status !== 'available' && index.status !== 'empty';
		index.isPrivate = indexId.indexOf(':') >= 0;
	}

	/**
	 * Create or update a table row with the status of the index/corpus.
	 * 
	 * @param {*} index the normalized index object
	 * @param {*} $tr if set, the table row where the <td/> elements will be placed. If null a new <tr/> will be created and returned.
	 * @return {JQuery} the table row that was updated or generated, as a jquery object
	 */
	function drawCorpusRow(index, $tr) {
		$tr = $tr || $('<tr></tr>');
		
		// Can we search this index?
		// If not, we'll show the current index status after the name.
		var statusText;
		if (index.status === 'indexing') {
			statusText = ' (indexing) - '
			+ index.indexProgress.filesProcessed + ' files, '
			+ index.indexProgress.docsDone + ' documents, and '
			+ index.indexProgress.tokensProcessed + ' tokens indexed so far...';
		} else if (index.status != 'available') {
			statusText = ' (' + index.status + ')';
		} else {
			statusText = '';
		}
		
		// Show the add data / delete corpus icons?
		// (only for private corpora that are not being written to at the moment)
		var delIcon = '', addIcon = '';
		if (index.isPrivate && !index.isBusy) {
			delIcon = '<a class="icon fa fa-trash" title="Delete \'' + index.displayName + '\' corpus" ' +
				'href="#" onclick="return CORPORA.deleteCorpus(\'' + index.id + '\');"></a>';
			addIcon = '<a class="icon fa fa-plus-square" title="Add data to \'' + index.displayName + '\' corpus" ' +
				'href="#" onclick="return CORPORA.showUploadForm(corpora[\'' + index.id + '\']);">' +
				'</a>';
		}
		
		// The index title and search icon (both clickable iff the index can be searched)
		var searchIcon = '<a class="icon disabled fa fa-search"></a>';
		var indexTitle = index.displayName;
		if (index.canSearch) {
			var pageURL = window.location.href;
			if (pageURL[pageURL.length-1] !== '/') {
				pageURL += '/';
			}
			var url = pageURL + index.id + '/search';
			searchIcon = '<a class="icon fa fa-search" title="Search \'' + index.displayName + 
				'\' corpus" href="'+ url + '"></a>';
			indexTitle = '<a title="Search \'' + index.displayName + '\' corpus" href="' + 
				url + '">' + index.displayName + '</a>';
		}
		
		// Add HTML for this corpus to the appropriate list.
		var optColumns = '';
		if (index.isPrivate) {
			optColumns = 
				'<td>' + friendlyDocFormat(index.documentFormat) + '</td>' +
				'<td>' + dateOnly(index.timeModified) + '</td>';
		}
		$tr.html(
			'<td class="corpus-name">' + indexTitle + statusText + '</td>' +
			'<td>' + delIcon + '</td>' +
			'<td class="size">' + abbrNumber(index.tokenCount) + '</td>' +
			optColumns +
			'<td>' + addIcon + '</td>' +
			'<td>' + searchIcon + '</td>');

		return $tr;
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
			

			$.each(data.indices, function(indexId, index) {
				normalizeIndexData(indexId, index);
				corpora[indexId] = index;

				var $tr = drawCorpusRow(index, null);

				if (index.isPrivate)
					privateCorpora.push($tr);
				else 
					publicCorpora.push($tr);

				if (index.status === 'indexing')
					refreshIndexStatusWhileIndexing(indexId, function(index) { drawCorpusRow(index, $tr) }, function(errorMsg) {$tr.children().first().text(errorMsg)});
			});
		
	
			// Determine which headings and lists to show
			// (we only show the private list to people who are authorised to do something there,
			//  and we only show the public list if there are any public corpora on the server)
			var showPublic = publicCorpora.length > 0;
			var showPrivate = data.user.loggedIn && (privateCorpora.length > 0 || data.user.canCreateIndex);

			// Put the HTML in the two lists.
			$('#corpora').empty().append(publicCorpora);
			$('#corpora-private').empty().append(privateCorpora);

			// Show/hide elements
			$('#corpora-all-container').toggle(showPublic || showPrivate);
			$('#corpora-public-container').toggle(showPublic);
			$('#corpora-private-container').toggle(showPrivate);
			$('#create-corpus').toggle(data.user.canCreateIndex);
			
			if (!(showPublic || showPrivate)) {
				showError('Sorry, no corpora are available, and you are not authorized to create a corpus. Please contact <a href="mailto:servicedesk@ivdnt.org">servicedesk@ivdnt.org</a> if this is an error.');
			}

		}
		
		// Perform the AJAX request to get the list of corpora.
		$('#waitDisplay').show();
		$.ajax(CORPORA.blsUrl, {
			'type': 'GET',
			'accept': 'application/json',
			'dataType': 'json',
			'success': function (data) {
				updateCorporaLists(data);
				if (functionToCallAfterwards) {
					functionToCallAfterwards();
				}
			},
			'error': function (jqXHR, textStatus, errorThrown) {
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + '; ' + errorThrown;
				showError('Error retrieving corpus list: ' + msg);
			},
			complete: function() {
				$('#waitDisplay').hide();
			}
		});
	}

	function refreshFormatList() {		
		$.ajax(CORPORA.blsUrl + '/input-formats/', {
			type: 'GET',
			accept: 'application/json',
			dataType: 'json',
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
					var shortId = isUserFormat ? formatId.substr(formatId.indexOf(data.user.id) + data.user.id.length + 1) : formatId;
					
					var $option = $('<option title="' + (format.description || format.displayName) + '" value="' + formatId + '" data-content="'+format.displayName+' <small>('+shortId+')</small>" >'+format.displayName+'</option>');
					
					var $tr = $([
						'<tr>',
						'<td>', shortId, '</td>',
						'<td>', format.displayName, '</td>',
						'<td><a class="fa fa-trash" data-format-operation="delete" data-format-id="'+formatId+'" title="Delete format \''+shortId+'\'" href="javascript:void(0)"></a></td>',
						'<td><a class="fa fa-pencil" data-format-operation="edit" data-format-id="'+formatId+'" title="Edit format \''+shortId+'\'" href="javascript:void(0)"></a></td>',
						'</tr>'].join(''));
				
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
					.filter(':not(#format_preset)').children('optgroup:nth-child(1)').append($nonConfigBasedOptions);
				$select.selectpicker('refresh');

				$('#formats-all-container').toggle(data.user.loggedIn && data.user.canCreateIndex);
			},
			error: function(/*jqXHR, textStatus, errorThrown*/) {
				showError('Error retrieving input formats.');
			}
		});
	}
	
	function friendlyDocFormat(format) {
		if (format.substr(0, 3).toLowerCase() == 'tei') {
			return 'TEI';
		}
		if (format.substr(0, 5).toLowerCase() == 'folia') {
			return 'FoLiA';
		}
		return format;
	}

	// Get the currently logged-in user, or the empty string if no user is logged in.
	function getUserId() {
		return serverInfo.user.loggedIn ? serverInfo.user.id : '';
	}

	// Show success message at the top of the page.
	function showSuccess(msg) {
		$('#errorDiv').hide();
		$('#successMessage').html(msg);
		$('#successDiv').show();
	
	}

	// Show error at the top of the page.
	function showError(msg) {
		$('#successDiv').hide();
		$('#errorMessage').html(msg).show();
		$('#errorDiv').show();
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
		var indexName = getUserId() + ':' + shortName;
		
		// Create the index.
		$('#waitDisplay').show();
		$.ajax(CORPORA.blsUrl, {
			'type': 'POST',
			'accept': 'application/json',
			'dataType': 'json',
			'data': {
				'name': indexName,
				'display': displayName,
				'format': format
			},
			'success': function (/*data*/) {
				$('#waitDisplay').hide();
				refreshCorporaList();
				showSuccess('Corpus "' + displayName + '" created.');
			},
			'error': function (jqXHR, textStatus, errorThrown) {
				$('#waitDisplay').hide();
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + '; ' + errorThrown;
				showError('Could not create corpus "' + shortName + '": ' + msg);
			},
		});
	}

	// What corpus are we uploading data to?
	var uploadToCorpus = null;

	// Makes the upload form visible and sets the corpus we're uploading to
	CORPORA.showUploadForm = function (index) {
		if (uploadToCorpus == index) {
			$('#upload-file-dialog').modal('toggle');
		}
		else {
			$('#upload-file-dialog').modal('show');
		}
		$('#uploadCorpusName').text(index.displayName);
		$('#uploadFormat').text(friendlyDocFormat(index.documentFormat) + ' ');
		uploadToCorpus = index;
		
		$('#uploadErrorDiv').hide();
		$('#uploadSuccessDiv').hide();
		$('.progress').hide();
		
		return false; // prevent event bubbling
	};

	// Delete an index from your private user area
	CORPORA.deleteIndex = function (index) {
		$('#waitDisplay').show();

		$.ajax(CORPORA.blsUrl + index.id, {
			'type': 'DELETE',
			'accept': 'application/json',
			'dataType': 'json',
			'success': function (/*data*/) {
				$('#waitDisplay').hide();
				refreshCorporaList(function () {
					showSuccess('Corpus "' + index.displayName + '" deleted.');
				});
			},
			'error': function (jqXHR, textStatus, errorThrown) {
				$('#waitDisplay').hide();
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + '; ' + errorThrown;
				showError('Could not delete corpus "' + index.displayName + '": ' + msg);
			},
		});
		
		return false; // prevent event bubbling
	};

	function initFileUpload() {
		var $progress = $('#uploadProgress');
		var $success = $('#uploadSuccessDiv');
		var $error = $('#uploadErrorDiv');

		var	$docInput = $('#upload-docs-input');
		var $metadataInput = $('#upload-metadata-input');
		var $form = $('#document-upload-form');

		$form.find('input').on('change', function() {
			var $this = $(this);
			var text;
			if (this.files && this.files.length)
				text = this.files.length + $this.data('labelWithValue');
			else 
				text = $this.data('labelWithoutValue');

			$($this.data('labelId')).text(text);
		}).trigger('change'); // init labels
		
		function handleUploadProgress(event) {
			var progress = event.loaded / event.total * 100;
			$progress
				.text('Uploading... (' +  Math.floor(progress) + '%)')
				.css('width', progress + '%')
				.attr('aria-valuenow', progress);

			if (event.loaded >= event.total)
				handleUploadComplete.call(this, event);
		}

		function handleUploadComplete(event) {
			$progress.css('width', '100%');

			refreshIndexStatusWhileIndexing(uploadToCorpus.id, 
				function(index) { 
					var statusText = '';
					if (index.status === 'indexing'){
						statusText = 'Indexing in progress... - '
						+ index.indexProgress.filesProcessed + ' files, '
						+ index.indexProgress.docsDone + ' documents, and '
						+ index.indexProgress.tokensProcessed + ' tokens indexed so far...';
					} else {
						statusText = 'Finished indexing!';
					}
					$progress.text( statusText);
				},
				function(errorMsg) {
					$progress.text(errorMsg);
				}
			);
		}

		function handleIndexingComplete(event) {
			if (this.status != 200)
				return handleError.call(this, event);
			
			var message = 'Data added to "' + uploadToCorpus.displayName + '".';
			
			refreshCorporaList();
	
			$progress.parent().hide();
			$form.show();
			$error.hide();
			$success.text(message).show();
			
			$docInput.val(undefined).trigger('change');
			$metadataInput.val(undefined).trigger('change');
		}
		
		function handleError(event) {
			var msg = 'Could not add data to "' + uploadToCorpus.displayName + '"';
			if (this.responseText) 
				msg += ': ' + JSON.parse(this.responseText).error.message;
			else if (this.textStatus)
				msg += ': ' + this.textStatus;
			else 
				msg += ': unknown error (are you trying to upload too much data?)';
			
			$progress.parent().hide();
			$form.show();
			$success.hide();
			$error.text(msg).show();
		}

		function verifyInput() {
			if(!$docInput[0].files || $docInput[0].files.length == 0) {
				$error.text('You must select at least 1 document').show();
				$success.hide();
				return false;
			} 
			return true;
		}

		$form.on('submit', function(event) {
			event.preventDefault();
			if (!verifyInput())
				return false;

			$form.hide();
			$progress.text('Connecting...').css('width', '0%').parent().show();
			$error.hide();
			$success.hide();
			
			var formData = new FormData();
			$.each($docInput[0].files, function(index, file) {
				formData.append('data[]', file, file.name);
			});
			$.each($metadataInput[0].files, function(index, file) {
				formData.append('metadata[]', file, file.name);
			});

			var xhr = new XMLHttpRequest();
			
			xhr.upload.addEventListener('progress', handleUploadProgress.bind(xhr));
			xhr.upload.addEventListener('error', handleError.bind(xhr));
			xhr.upload.addEventListener('abort', handleError.bind(xhr));
			// Don't bother attaching event listener 'load' on xhr.upload - it's broken in IE and Firefox
			// Instead manually trigger uploadcomplete when we reach 100%
			xhr.addEventListener('load', handleIndexingComplete.bind(xhr));
			xhr.addEventListener('error', handleError.bind(xhr));
			xhr.addEventListener('abort', handleError.bind(xhr));

			xhr.open('POST', CORPORA.blsUrl + uploadToCorpus.id + '/docs?outputformat=json', true);
			xhr.send(formData);

			return false;
		});

	}

	function initNewCorpus() {
		var $newCorpusModal = $('#new-corpus-modal');
		var $corpusNameInput = $('#corpus_name');
		var $corpusFormatSelect = $('#corpus_document_type');
		var $saveButton = $('#new-corpus-modal .btn-primary');
		
		$newCorpusModal.on('shown.bs.modal', function(/*event*/) {
			$corpusNameInput.val('');
			$saveButton.prop('disabled', true);
			$corpusNameInput[0].focus();
		});
		$corpusNameInput.on('change, input', function(/*event*/) {
			$saveButton.prop('disabled', $(this).val().length <= 2);
		});
		// Enable submit through pressing the 'enter' key while a form element has the focus
		$('input, select', $newCorpusModal).on('keydown', function(event) {
			if (event.keyCode == 13) {
				event.preventDefault();
				if (!$saveButton.prop('disabled')) {
					$saveButton.click();
				}
			}
		});
		$saveButton.on('click', function(event) {
			event.preventDefault();
			if ($(this).prop('disabled'))
				return;
			
			var corpusName = $corpusNameInput.val();
			var format = $corpusFormatSelect.val();
			$newCorpusModal.modal('hide');
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
		var $confirmButton = $modal.find('#modal-confirm-confirm');
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
		};
	})();


	CORPORA.deleteCorpus = function(indexId) {
		// strip username portion from indexId (indexId has the format username:indexname)
		var indexName = indexId.substr(Math.max(indexId.indexOf(':')+1, 0)); 

		confirmDialog(
			'Delete corpus?', 
			'You are about to delete corpus <b>' + indexName + '</b>. <i>This cannot be undone!</i> <br><br>Are you sure?',
			'Delete',
			CORPORA.deleteIndex.bind(null,  corpora[indexId])
		);

		return false; // prevent event bubbling
	};

	function generateShortName(name) {
		return name.replace(/[^\w]/g, '-').replace(/^[_\d]+/, '');
	}

	function initNewFormat() {
		
		var $modal = $('#new-format-modal');

		var $fileInput = $('#format_file');
		var $presetSelect = $('#format_preset');
		var $downloadButton = $('#format_download');

		var $formatName = $('#format_name');
		var $formatType = $('#format_type');
		var editor = CodeMirror.fromTextArea($('#format_editor')[0], {
			mode: 'yaml',
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
			formData.append('data', file, file.name);

			$.ajax(CORPORA.blsUrl + '/input-formats/', {
				data: formData,
				processData: false,
				contentType: false,
				type: 'POST',
				accept: 'application/javascript',
				dataType: 'json',
				success: function (data) {
					$modal.modal('hide');
					$formatName.val('');
					editor.setValue('');

					refreshFormatList();
					showSuccess(data.status.message);
				},
				error: function (jqXHR, textStatus/*, errorThrown*/) {
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
			if (newMode === 'json') {
				editor.setOption('mode', {
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
				};
				fr.readAsText(file);
			}
		});

		$downloadButton.on('click', function() {
			var presetName = $presetSelect.selectpicker('val');
			var $formatName = $('#format_name');

			$.ajax(CORPORA.blsUrl + '/input-formats/' + presetName,  {
				'type': 'GET',
				'accept': 'application/javascript',
				'dataType': 'json',
				'success': function (data) {
					var configFileType = data.configFileType.toLowerCase();
					if (configFileType === 'yml')
						configFileType = 'yaml';
					
					$formatType.selectpicker('val', configFileType);
					$formatType.trigger('change');
					editor.setValue(data.configFile);

					// is a user-owned format and no name for the format has been given yet
					// set the format name to this format so the user can easily save over it
					if (!$formatName.val() && presetName.indexOf(':') > 0) 
						$formatName.val(presetName.substr(presetName.indexOf(':')+1));
				},
				'error': function (jqXHR, textStatus/*, errorThrown*/) {
					showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
				},
			});
		});

		$confirmButton.on('click', function() {
			if (!$formatName.val()) {
				showFormatError('Please enter a name.');
				return;
			}
			
			var fileContents = editor.getValue();
			var fileName = $formatName.val() + '.' + $formatType.selectpicker('val');
			
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
	
			var formatId = $(this).data('format-id');
			
			confirmDialog(
				'Delete import format?',
				'You are about to delete the import format <i>' + formatId + '</i>.<br>Are you sure?',
				'Delete', 
				function() {
					$.ajax(CORPORA.blsUrl + '/input-formats/' + formatId, {
						type: 'DELETE',
						accept: 'application/javascript',
						dataType: 'json',
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

	function initEditFormat() {
		$('table[data-autoupdate="format"]').on('click', '[data-format-operation="edit"]', function(event) {
			event.preventDefault();
			var formatId = $(this).data('format-id');
			
			var $modal = $('#new-format-modal');
			var $presetSelect = $('#format_preset');
			var $downloadButton = $('#format_download');
			var $formatName = $('#format_name');
			// formattype determined after download succeeds			
			
			$presetSelect.selectpicker('val', formatId);
			$downloadButton.click();
			$formatName.val(formatId.substr(Math.max(formatId.indexOf(':')+1, 0))); // strip username portion from formatId as username:formatname, if preset
			
			$modal.modal('show');
		});
	}

	$(document).ready(function () {
		CORPORA.blsUrl = $('.contentbox').data('blsUrl');
		
		// Get the list of corpora.
		refreshCorporaList();
		refreshFormatList();
		
		// Wire up the AJAX uploading functionality.
		initFileUpload();
		
		// Wire up the "new corpus" and "delete corpus" buttons.
		initNewCorpus();
		
		initNewFormat();
		initDeleteFormat();
		initEditFormat();
	});
})();

