/* global CodeMirror, Mustache, $ */

/**
 * @typedef IndexProgress
 *
 * @property {number} filesProcessed
 * @property {number} docsDone - a single file may containing multiple documents
 * @property {number} tokensProcessed
 */

/**
 * @typedef BLIndex
 *
 * @property {string} displayName
 * @property {string} [documentFormat] - id of the document format of the corpus, not always set per se, also in the format of username:formatname
 * @property {string} timeModified
 * @property {('available'|'empty'|'indexing')} indexStatus
 * @property {number} tokenCount - number of tokens in the corpus (not accurate while indexing)
 * @property {IndexProgress} [indexProgress] - data about the indexing progress if indexState === 'indexing'
 */

/**
 * @typedef NormalizedIndex
 *
 * @property {string} id - ID of the corpus, in the format of username:corpusname, or just corpusname if is is not a user corpus
 * @property {string} shortId - ID of the corpus minus the username: portion
 * @property {string} documentFormat - fall back to '' if missing
 * @property {boolean} canSearch - is the index available for searching
 * @property {boolean} isBusy
 * @property {boolean} isPrivate - is this a user-defined corpus
 */

/**
 * @typedef {BLIndex|NormalizedIndex} Index
 * JSDoc doesn't allow inheritance in typedef blocks, so work around it
 */

/**
 * @typedef BLFormat
 *
 * @property {string} [displayName]
 * @property {string} [description]
 * @property {string} helpUrl
 * @property {boolean} configurationBased - is the format backed by a .blf.json/.blf.yaml configution file
 */

/**
 * @typedef NormalizedFormat
 *
 * @property {string} id - ID of the format, in the format of username:formatname
 * @property {string} shortId - formatId without the username: portion
 * @property {string} displayName - set to shortId as fallback if missing
 * @property {string} description - set to displayName as fallback if missing
 * @property {boolean} isPrivate - is this a user-defined format
 */

/**
 * @typedef {BLFormat| NormalizedFormat} Format
 * JSDoc doesn't allow inheritance in typedef blocks, so work around it
 */

/**
 * @typedef User
 *
 * @property {boolean} loggedIn
 * @property {string} id
 * @property {boolean} canCreateIndex
 */

/**
 * @typedef ServerInfo
 *
 * @property {string} blacklabBuildTime
 * @property {string} blacklabVersion
 * @property {string} helpPageUrl
 * @property {Object<string, BLIndex>} indices
 * @property {User} user
 * @property {object} [cacheStatus] - only when in debug mode? unused here
 */

// (Private) corpora management page.
//
// Show a list of public and private corpora;
// Allows user to create and delete private corpora
// and add data to them.


// (avoid polluting the global namespace)
(function() {
	'use strict';
	
	// blacklab-server url
	var blsUrl;
	// Contains the full list of available corpora
	var corpora = [];
	// Contains the full list of available formats
	var formats = [];
	// Serverinfo, contains user information etc
	var serverInfo = {};

	var $root = $(document);
	function createTrigger(eventType, $target) {
		return function(payload) {
			// need to wrap payload in array to prevent jquery from unpacking it into multiple arguments on the receiving side
			($target || $root).trigger(eventType, [payload]);
		};
	}

	/**
	 * @param {string} [selector] - jquery, may be omitted, in which case the signature becomes (eventType, handler)
	 * @param {string} eventType - from events object, or custom
	 * @param {Function} handler - callback function, 'this' is set to a single jquery element in selector (undefined if selector omitted)
	 */
	function createHandler(a, b, c) {
		var handlerContext = (typeof b === 'function') ? undefined : $(a);
		var eventType = handlerContext ? b : a;
		var handler = handlerContext ? c : b;

		$root.on(eventType, function(event, payload) {
			if (handlerContext) {
				handlerContext.each(function () {
					handler.call($(this), payload);
				});
			} else {
				handler.call(undefined, payload);
			}
		});
	}
	function createHandlerOnce(a,b,c) {
		var selector = (typeof b === 'function') ? undefined : a;
		var eventType = selector ? b : a;
		var handler = selector ? c : b;

		$root.one(eventType, function(event, payload) {
			handler.call( selector ? $(selector) : undefined, payload);
		});
	}

	var events = {
		SERVER_REFRESH: 'server/refresh',
		FORMATS_REFRESH: 'formats/refresh',
		CORPORA_REFRESH: 'corpora/refresh', // all corpora
		CORPUS_REFRESH: 'corpus/refresh' // single corpus
	};

	var triggers = {
		/** @param {Array.<Format>} payload - data passed into the handler */
		updateFormats: createTrigger(events.FORMATS_REFRESH),
		/** @param {ServerInfo} payload - server status from blacklab-server */
		updateServer: createTrigger(events.SERVER_REFRESH),
		/** @param {Array.<Index>} payload - normalized index data */
		updateCorpora: createTrigger(events.CORPORA_REFRESH),
		/** @param {Index} payload - normalized index data */
		updateCorpus: createTrigger(events.CORPUS_REFRESH)
	};

	// Attach these handlers first, so that we can store data before other handlers run
	createHandler(events.SERVER_REFRESH, function(serverInfo_) { serverInfo = $.extend({}, serverInfo_); });
	createHandler(events.CORPORA_REFRESH, function(corpora_) { corpora = [].concat(corpora_); });
	createHandler(events.FORMATS_REFRESH, function(formats_) { formats = [].concat(formats_); });
	createHandler(events.CORPUS_REFRESH, function(corpus_) {
		corpus_ = $.extend({}, corpus_);
		// merge into list, trigger global corpora refresh
		var i = corpora.findIndex(function(corpus) { return corpus.id === corpus_.id; });
		i >= 0 ? corpora[i] = corpus_ : corpora.push(corpus_);
		triggers.updateCorpora(corpora);
	});

	createHandlerOnce(events.SERVER_REFRESH, function(serverInfo) {
		if (serverInfo.user.canCreateIndex)
			$('#corpora-private-container, #formats-all-container').show();
	});

	createHandlerOnce(events.CORPORA_REFRESH, function(corpora) {
		if (corpora.find(function(corpus) { return !corpus.isPrivate; }) != null)
			$('#corpora-public-container').show();
	});

	createHandlerOnce('*[data-autoupdate="username"]', events.SERVER_REFRESH, function(serverInfo) {
		this.show().html(serverInfo.user.loggedIn ? 'Logged in as <em>'+serverInfo.user.id+'</em>' : 'Not logged in');
	});

	createHandler('tbody[data-autoupdate="format"]', events.FORMATS_REFRESH, function(formats) {
		formats = formats.filter(function(format) {
			// only let through through user formats
			return format.id.indexOf(serverInfo.user.id) === 0;
		});

		var template =
		'{{#formats}}'+
		'<tr>'+
			'<td>{{shortId}}</td>'+
			'<td>{{displayName}}</td>'+
			'<td><a class="fa fa-trash" data-format-operation="delete" data-format-id="{{id}}" title="Delete format \'{{displayName}}\'" href="javascript:void(0)"></a></td>'+
			'<td><a class="fa fa-pencil" data-format-operation="edit" data-format-id="{{id}}" title="Edit format \'{{displayName}}\'" href="javascript:void(0)"></a></td>'+
		'</tr>'+
		'{{/formats}}';

		this.html(Mustache.render(template, {
			formats: formats,
		}));
	});

	createHandler('select[data-autoupdate="format"]', events.FORMATS_REFRESH, function(formats) {
		var showNonConfigBased = this.data('filter') !== 'configBased';

		formats = formats.filter(function(format) {
			return showNonConfigBased || format.configurationBased;
		});

		var template =
		'<optgroup label="Presets">' +
			'{{#builtinFormats}}' +
			'<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>' +
			'{{/builtinFormats}}' +
		'</optgroup>' +
		'<optgroup label="{{userName}}">' +
			'{{#userFormats}}' +
			'<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>' +
			'{{/userFormats}}' +
		'</optgroup>';

		this
			.html(Mustache.render(template, {
				userName: serverInfo.user.id,
				builtinFormats: formats.filter(function(format) { return format.id === format.shortId; }),
				userFormats: formats.filter(function(format) { return format.id !== format.shortId; })
			}))
			.selectpicker('refresh')
			.trigger('change');
	});

	createHandler('tbody[data-autoupdate="corpora"]', events.CORPORA_REFRESH, function(corpora) {
		var filter = this.data('filter');

		if (filter === 'public') corpora = corpora.filter(function(corpus) { return !corpus.isPrivate; });
		else if (filter === 'private') corpora = corpora.filter(function(corpus) { return corpus.isPrivate; });

		// generate some data we need for rendering
		corpora = corpora.map(function(corpus) {
			var status = corpus.status;
			if (status === 'indexing') {
				status = ' (indexing) - ' + corpus.indexProgress.filesProcessed + ' files, ' +
					corpus.indexProgress.docsDone + ' documents, and ' +
					corpus.indexProgress.tokensProcessed + ' tokens indexed so far...';
			} else if (!corpus.canSearch) {
				status = ' (' + status + ')';
			} else  {
				status = '';
			}

			var pageURL = window.location.href;
			if (pageURL[pageURL.length-1] !== '/') {
				pageURL += '/';
			}

			var user__format = corpus.documentFormat.split(':');
			var isUserFormat = user__format.length === 2;
			var documentFormatShortId = user__format[isUserFormat ? 1 : 0];
			var documentFormatOwner = isUserFormat ? user__format[0] : null;

			return $.extend({}, corpus, {
				status: status,
				sizeString: abbrNumber(corpus.tokenCount),
				isUserFormat: isUserFormat,
				documentFormatShortId: documentFormatShortId,
				documentFormatOwner: documentFormatOwner,
				searchUrl: pageURL + corpus.id + '/search',
				timeModified: dateOnly(corpus.timeModified)
			});
		});

		var template =
		'{{#corpora}} \
		<tr> \
			<td><a title="Search the \'{{displayName}}\' corpus" class="icon fa fa-search {{^canSearch}}disabled{{/canSearch}}" {{#canSearch}}href="{{searchUrl}}"{{/canSearch}}></a></td> \
			<td class="corpus-name">{{displayName}} {{status}}</td>\
			<td>{{sizeString}}</td>\
			{{#isPrivate}} \
				<td {{#isUserFormat}}title="Format owned by {{documentFormatOwner}}"{{/isUserFormat}}>{{#isUserFormat}}*{{/isUserFormat}}{{documentFormatShortId}}</td>\
				<td>{{timeModified}}</td>\
				<td><a data-corpus-action="delete" data-id="{{id}}" title="Delete the \'{{displayName}}\' corpus" class="icon fa fa-trash {{#isBusy}}disabled{{/isBusy}}" href="javascript:void(0)"></a></td> \
				<td><a data-corpus-action="upload" data-id="{{id}}" title="Upload documents to the \'{{displayName}}\' corpus" class="icon fa fa-plus-square {{#isBusy}}disabled{{/isBusy}}" href="javascript:void(0)"></a></td>\
				<td><a data-corpus-action="share" data-id="{{id}}" title="Share the \'{{displayName}}\' corpus" class="icon fa fa-user-plus" href="javascript:void(0)"></a></td>\
			{{/isPrivate}} \
		</tr>\
		{{/corpora}}';

		this.html(Mustache.render(template, {
			corpora: corpora
		}));
	});

	$('#corpora-private-container').on('click', '*[data-corpus-action="delete"]:not(.disabled)', function deleteCorpus(event) {
		event.preventDefault();
		event.stopPropagation();

		var $this = $(event.target);
		var corpusId = $this.data('id');
		var corpus = corpora.find(function(corpus) { return corpus.id === corpusId; });
		if (corpus == null)
			return;

		confirmDialog(
			'Delete corpus?',
			'You are about to delete corpus <b>' + corpus.displayName + '</b>. <i class="text-danger">This cannot be undone!</i> <br><br>Are you sure?',
			'Delete',
			function ok() {
				$('#waitDisplay').show();

				$.ajax(blsUrl + corpusId, {
					'type': 'DELETE',
					'accept': 'application/json',
					'dataType': 'json',
					'success': function () {
						$('#waitDisplay').hide();
						showSuccess('Corpus "' + corpus.displayName + '" deleted.');
						refreshCorporaList();
					},
					'error': function (jqXHR, textStatus, errorThrown) {
						$('#waitDisplay').hide();
						var data = jqXHR.responseJSON;
						var msg;
						if (data && data.error)
							msg = data.error.message;
						else
							msg = textStatus + '; ' + errorThrown;
						showError('Could not delete corpus "' + corpus.displayName + '": ' + msg);
					},
				});

			}
		);
	});

	$('#corpora-private-container').on('click', '*[data-corpus-action="upload"]:not(.disabled)', function showUploadForm(event) {
		event.preventDefault();
		event.stopPropagation();
		var $this = $(event.target);
		var corpusId = $this.data('id');
		var corpus = corpora.find(function(corpus) { return corpus.id === corpusId; });
		if (corpus == null)
			return;

		var format = formats.find(function(format) {return format.id === corpus.documentFormat;});

		$('#uploadCorpusName').text(corpus.displayName);
		$('#uploadFormat').text(corpus.documentFormat + ' ');
		$('#uploadFormatDescription').text(format ? format.description : 'Unknown format (it may have been deleted from the server), uploads might fail');

		//clear selected files
		$('#document-upload-form input[type="file"]').each(function() { $(this).val(undefined); }).trigger('change');

		$('#uploadErrorDiv').hide();
		$('#uploadSuccessDiv').hide();
		$('.progress').hide();

		// finally show the modal
		uploadToCorpus = corpus; // global
		$('#upload-file-dialog').modal('show');
	});

	$('#corpora-private-container').on('click', '*[data-corpus-action="share"]:not(.disabled)', function shareCorpus(event) {
		event.preventDefault();
		event.stopPropagation();
		var $this = $(event.target);
		var corpusId = $this.data('id');
		var corpus = corpora.find(function(corpus) { return corpus.id === corpusId; });
		if (corpus == null)
			return;

		$.ajax(blsUrl + '/' + corpusId + '/sharing', {
			'type': 'GET',
			'accept': 'application/json',
			'dataType': 'json',
			'cache': false,
			'success': function (data) {
				$('#share-corpus-editor').val(data['users[]'].join('\n'));
				$('#share-corpus-form').data('corpus', corpus);
				$('#share-corpus-name').text(corpus.displayName);
				$('#share-corpus-modal').modal('show');
			},
			'error': function (jqXHR, textStatus, errorThrown) {
				console.log(arguments);
			},
			// 'complete': function() {
			// }
		});
	});

	$('#share-corpus-form').on('submit', function(event) {
		event.preventDefault();

		var corpus = $(this).data('corpus');
		var $modal = $('#share-corpus-modal');
		var $editor = $('#share-corpus-editor');
		var users = $editor.val().trim().split(/\s*[\r\n]+\s*/g); // split on line breaks, ignore empty lines.

		$.ajax(blsUrl + '/' + corpus.id + '/sharing/', {
			'type': 'POST',
			'accept': 'application/json',
			'dataType': 'json',
			'data': {
				'users[]': users,
			},
			success: function (data) {
				showSuccess(data.status.message);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				var data = jqXHR.responseJSON;
				var msg;
				if (data && data.error)
					msg = data.error.message;
				else
					msg = textStatus + '; ' + errorThrown;
				showError('Could not share corpus "' + corpus.displayName + '": ' + msg);
			},
			complete: function() {
				$editor.val(undefined);
				$modal.modal('hide');
			}
		});
	});

	// Abbreviate a number, i.e. 3426 becomes 3,4K,
	// 2695798 becomes 2,6M, etc.
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
	function refreshIndexStatusWhileIndexing(indexId) {
		var statusUrl = blsUrl + indexId + '/status/';

		var timeoutHandle;

		function success(index) {
			triggers.updateCorpus(normalizeIndexData(index, indexId));

			if (index.status !== 'indexing')
				clearTimeout(timeoutHandle);
			else
				setTimeout(run, 2000);
		}

		function error(jqXHR, textStatus, errorThrown) {
			var indexName = indexId.substr(indexId.indexOf(':')+1);

			var data = jqXHR.responseJSON;
			var msg;
			if (data && data.error)
				msg = data.error.message;
			else
				msg = textStatus + '; ' + errorThrown;

			showError('Error retrieving status for corpus \''+indexName+'\': ' + msg);
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
	 * @param {BLIndex} index the index json object as received from blacklab-server
	 * @param {string} indexId full id of the index, including username portion (if applicable)
	 * @returns {Index}
	 */
	function normalizeIndexData(index, indexId) {
		var shortId = indexId.substr(indexId.indexOf(':')+1);
		return $.extend({}, index, {
			id: indexId,
			shortId: shortId,
			// displayName always set
			documentFormat: index.documentFormat || '',
			canSearch: index.status === 'available',
			isBusy: index.status !== 'available' && index.status !== 'empty',
			isPrivate: shortId !== indexId,
		});
	}

	/**
	 * @param {BLFormat} format as received from the server
	 * @param {string} formatId - full id of the format, including userName portion (if applicable)
	 * @return {Format} normalized version of the format
	 */
	function normalizeFormatData(format, formatId) {
		var shortId = formatId.substr(formatId.indexOf(':')+1);
		return $.extend({}, format, {
			id: formatId,
			shortId: shortId,
			displayName: format.displayName || shortId,
			description: format.description || format.displayName || shortId,
			isPrivate: shortId !== formatId
		});
	}

	// Request the list of available corpora and
	// update the corpora page with it.
	function refreshCorporaList() {
		// Perform the AJAX request to get the list of corpora.
		$('#waitDisplay').show();
		$.ajax(blsUrl, {
			'type': 'GET',
			'accept': 'application/json',
			'dataType': 'json',
			'success': function (data) {
				data = $.map(data.indices, normalizeIndexData);
				triggers.updateCorpora(data);
				data
					.filter(function(corpus) { return corpus.status === 'indexing'; })
					.forEach(function(corpus) { refreshIndexStatusWhileIndexing(corpus.id); });
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
		$.ajax(blsUrl + '/input-formats/', {
			type: 'GET',
			accept: 'application/json',
			dataType: 'json',
			success: function(data) {
				triggers.updateServer($.extend({}, serverInfo, {
					user: data.user
				}));
				triggers.updateFormats(
					$.map(data.supportedInputFormats, normalizeFormatData)
						.sort(function(a, b) {
							return a.id.localeCompare(b.id); // sort alphabetically by id
						})
				);
			},
			error: function(jqXHR, textStatus, errorThrown) {
				// TODO centralize error reporting, json, xml and generic network
				if (jqXHR.status != 404) { // blacklab returns internal errors as xml(?)
					var xmlDoc = $.parseXML( jqXHR.responseText );
					var $xml = $( xmlDoc );
					var error = $xml.find( 'error code' ).text();
					var message = $xml.find(' error message ').text();

					showError('Error retrieving input formats: ' + error + '; ' + message);
				} else {
					showError('Error retrieving input formats: ' + jqXHR.status + ' ' + errorThrown);
				}
			}
		});
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
		$.ajax(blsUrl, {
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

	createHandler('#uploadProgress', events.CORPORA_REFRESH, function(corpora) {
		var displayedCorpusId = this.data('corpus-id');
		if (!displayedCorpusId)
			return;

		var corpus = corpora.find(function(corpus) { return corpus.id === displayedCorpusId; });
		if (!corpus)
			return;

		var statusText = '';
		if (corpus.status === 'indexing'){
			statusText = 'Indexing in progress... - '
			+ corpus.indexProgress.filesProcessed + ' files, '
			+ corpus.indexProgress.docsDone + ' documents, and '
			+ corpus.indexProgress.tokensProcessed + ' tokens indexed so far...';
		} else {
			statusText = 'Finished indexing!';
		}
		this.text(statusText);
	});

	// What corpus are we uploading data to?
	// TODO not very tidy
	var uploadToCorpus = null;

	function initFileUpload() {

		var $progress = $('#uploadProgress');
		var $success = $('#uploadSuccessDiv');
		var $error = $('#uploadErrorDiv');

		var $form = $('#document-upload-form');
		var	$fileInputs = $form.find('input[type="file"]');

		$fileInputs.each(function() {
			var $this = $(this);
			$this.on('change', function() {
				var text;
				if (this.files && this.files.length)
					text = this.files.length + $this.data('labelWithValue');
				else
					text = $this.data('labelWithoutValue');

				$($this.data('labelId')).text(text);
			});
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

		function handleUploadComplete(/*event*/) {
			$progress
				.css('width', '100%')
				.data('corpus-id', uploadToCorpus.id);

			refreshIndexStatusWhileIndexing(uploadToCorpus.id);
		}

		function handleIndexingComplete(event) {
			if (this.status != 200)
				return handleError.call(this, event);

			var message = 'Data added to "' + uploadToCorpus.displayName + '".';

			$progress.parent().hide();
			$form.show();
			$error.hide();
			$success.text(message).show();

			// clear values
			$fileInputs.each(function() {
				$(this).val(undefined).trigger('change');
			});
		}

		function handleError(/*event*/) {
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

		$form.on('submit', function(event) {
			event.preventDefault();

			$form.hide();
			$error.hide();
			$success.hide();
			$progress
				.text('Connecting...')
				.css('width', '0%')
				.parent().show();

			var formData = new FormData();
			$fileInputs.each(function() {
				var self = this;
				$.each(this.files, function(index, file) {
					formData.append(self.name, file, file.name);
				});
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

			xhr.open('POST', blsUrl + uploadToCorpus.id + '/docs?outputformat=json', true);
			xhr.send(formData);

			return false;
		});
	}

	function initNewCorpus() {
		var $newCorpusModal = $('#new-corpus-modal');
		var $corpusNameInput = $('#corpus_name');
		var $corpusFormatSelect = $('#corpus_document_type');
		var $corpusFormatDescription = $('#corpus_document_type_description');
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

		$corpusFormatSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
			var formatId = $(this).selectpicker('val');
			var format = formats.find(function(format) { return format.id === formatId; });
			// format always exists if it's present in the select to begin with
			
			$corpusFormatDescription.text(format.description);
		});
	}

	/**
	 * Show a dialog with custom message, title, and confirm button html
	 * Call a callback, only if the confirm button is pressed.
	 *
	 * @param {string} title
	 * @param {string} message
	 * @param {string} buttontext
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

	function generateShortName(name) {
		return name.replace(/[^\w]/g, '-').replace(/^[_\d]+/, '');
	}

	function initNewFormat() {
		var $modal = $('#new-format-modal');

		var $fileInput = $('#format_file');
		var $presetSelect = $('#format_select');
		var $presetInput = $('#format_preset');
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

			$.ajax(blsUrl + '/input-formats/', {
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

		$presetInput.val($presetSelect.selectpicker('val')); // init with current value
		$presetSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
			$presetInput.val($presetSelect.selectpicker('val'));
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
			var $this = $(this);
			var presetName = $presetInput.val();
			var $formatName = $('#format_name');

			if (!presetName || $this.prop('disabled'))
				return;

			$this.prop('disabled', true).append('<span class="fa fa-spinner fa-spin"></span>');
			hideFormatError();
			$.ajax(blsUrl + '/input-formats/' + presetName, {
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

					$this.closest('.collapse').collapse('hide');
				},
				'error': function (jqXHR, textStatus/*, errorThrown*/) {
					showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
				},
				'complete': function() {
					$this.prop('disabled', false).find('.fa-spinner').remove();
				}
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

		$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="delete"]', function(event) {
			event.preventDefault();

			var formatId = $(this).data('format-id');

			confirmDialog(
				'Delete import format?',
				'You are about to delete the import format <i>' + formatId + '</i>.<br>Are you sure?',
				'Delete',
				function() {
					$.ajax(blsUrl + '/input-formats/' + formatId, {
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
		$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="edit"]', function(event) {
			event.preventDefault();
			var formatId = $(this).data('format-id');

			var $modal = $('#new-format-modal');
			var $presetSelect = $('#format_select');
			var $downloadButton = $('#format_download');
			var $formatName = $('#format_name');
			// formattype determined after download succeeds

			$presetSelect.selectpicker('val', formatId).trigger('change');
			$downloadButton.click();
			$formatName.val(formatId.substr(Math.max(formatId.indexOf(':')+1, 0))); // strip username portion from formatId as username:formatname, if preset

			$modal.modal('show');
		});
	}

	$(document).ready(function () {
		blsUrl = $('.contentbox').data('blsUrl');

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

