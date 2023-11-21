// Bootstrap and bootstrap-select augment jquery
import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

// Whereas these register new highlighters for codemirror
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/mode/yaml/yaml.js';

import '@/utils/features/tutorial';

import '@/global.scss';

// Now import the augmented modules (though import order shouldn't matter)
import CodeMirror from 'codemirror';
import $ from 'jquery';
import * as Mustache from 'mustache';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import * as Api from '@/api';
import * as loginsystem from '@/utils/loginsystem';

const enum DataEvent {
	SERVER_REFRESH = 'server/refresh',
	FORMATS_REFRESH = 'formats/refresh',
	CORPORA_REFRESH = 'corpora/refresh', // all corpora
	CORPUS_REFRESH = 'corpus/refresh' // single corpus
}

interface DataEventPayloadMap {
	[DataEvent.SERVER_REFRESH]: BLTypes.BLServer;
	[DataEvent.FORMATS_REFRESH]: AppTypes.NormalizedFormat[];
	[DataEvent.CORPORA_REFRESH]: AppTypes.NormalizedIndexBase[];
	[DataEvent.CORPUS_REFRESH]: AppTypes.NormalizedIndexBase
}

// (Private) corpora management page.
//
// Show a list of public and private corpora;
// Allows user to create and delete private corpora
// and add data to them.

// Contains the full list of available corpora
let corpora: AppTypes.NormalizedIndexBase[] = [];
// Contains the full list of available formats
let formats: AppTypes.NormalizedFormat[] = [];
// Serverinfo, contains user information etc
let serverInfo: BLTypes.BLServer;

const $root = $(document);
function createTrigger<K extends keyof DataEventPayloadMap>(eventType: K, $target = $root) {
	return function(payload: DataEventPayloadMap[K]) {
		// need to wrap payload in array to prevent jquery from unpacking it into multiple arguments on the receiving side
		$target.trigger(eventType, [payload]);
	};
}

function createHandler<K extends keyof DataEventPayloadMap>({selector, event, handler}: {
	selector?: string,
	event: K,
	handler: (this: JQuery<HTMLElement>, payload: DataEventPayloadMap[K]) => void
}) {
	const $elements = selector ? $(selector) : undefined;

	$root.on(event, function(jqEvent, payload) {
		if ($elements) {
			$elements.each(function() {
				handler.call($(this), payload);
			});
		} else {
			handler.call($(), payload);
		}
	});
}

function createHandlerOnce<K extends keyof DataEventPayloadMap>({selector, event, handler}: {selector?: string, event: K, handler: (this: JQuery<HTMLElement>, payload: DataEventPayloadMap[K]) => void}) {
	const $elements = selector ? $(selector) : undefined;

	$root.one(event, function(jqEvent, payload) {
		if ($elements) {
			$elements.each(function() {
				handler.call($(this), payload);
			});
		} else {
			handler.call(undefined, payload);
		}
	});
}

const triggers = {
	updateFormats: (() => {
		const trigger = createTrigger(DataEvent.FORMATS_REFRESH);
		return (payload: DataEventPayloadMap[DataEvent.FORMATS_REFRESH]) => trigger(payload.sort((a, b) => a.displayName.localeCompare(b.displayName)));
	})(),
	updateServer: createTrigger(DataEvent.SERVER_REFRESH),
	updateCorpora: (() => {
		const trigger = createTrigger(DataEvent.CORPORA_REFRESH);
		return (payload: DataEventPayloadMap[DataEvent.CORPORA_REFRESH]) => trigger(payload.sort((a, b) => a.displayName.localeCompare(b.displayName)));
	})(),
	updateCorpus: createTrigger(DataEvent.CORPUS_REFRESH)
};

// Attach these handlers first, so that we can store data before other handlers run
createHandler({event: DataEvent.SERVER_REFRESH, handler(payload) { serverInfo = Object.assign({}, payload); }});
createHandler({event: DataEvent.CORPORA_REFRESH, handler(payload) { corpora = payload.concat().sort((a, b) => a.displayName.localeCompare(b.displayName)); }});
createHandler({event: DataEvent.FORMATS_REFRESH, handler(payload) { formats = payload.concat().sort((a, b) => a.displayName.localeCompare(b.displayName)); }});
createHandler({event: DataEvent.CORPUS_REFRESH, handler(payload) {
	// merge into list, trigger global corpora refresh
	const i = corpora.find(c => c.id === payload.id);
	// merge with old data, to preserve retrieved async data
	if (i) Object.assign(i, payload);
	else corpora.push(payload);
	corpora.sort((a, b) => a.displayName.localeCompare(b.displayName));
	triggers.updateCorpora(corpora);
}});

createHandler({event: DataEvent.SERVER_REFRESH, handler(newServerInfo) {
	// Don't hide when !canCreateIndex, user may have just hit the limit
	// (in this case it should be unhidden when a private corpus exists)
	if (newServerInfo.user.canCreateIndex) {
		$('#corpora-private-container').show();
	}

	$('#create-corpus').toggle(newServerInfo.user.canCreateIndex);
	$('#create-corpus-limited').toggle(!newServerInfo.user.canCreateIndex);
	$('#formats-all-container').toggle(newServerInfo.user.loggedIn);
}});

createHandler({event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	if (newCorpora.find(function(corpus) { return !corpus.owner; }) != null) {
		$('#corpora-public-container').show();
	}

	if (newCorpora.find(function(corpus) { return !!corpus.owner; }) != null) {
		$('#corpora-private-container').show();
	}
}});

createHandlerOnce({selector: '*[data-autoupdate="username"]', event: DataEvent.SERVER_REFRESH, handler(newServerInfo) {
	this.show().html(newServerInfo.user?.id || 'Not logged in');
}});

createHandler({selector: 'tbody[data-autoupdate="format"]', event: DataEvent.FORMATS_REFRESH, handler(newFormats) {
	// Always show user's own formats, even if isVisible == false
	newFormats = newFormats.filter(f => f.owner === serverInfo.user.id);

	const template =`
	{{#formats}}
	<tr>
		<td>{{shortId}}</td>
		<td>{{displayName}}</td>
		<td><a role="button" data-format-operation="edit" class="fa fa-fw fa-pencil" data-format-id="{{id}}" title="Edit format '{{displayName}}'"></a></td>
		<td><a role="button" data-format-operation="delete" class="fa fa-fw fa-trash" data-format-id="{{id}}" title="Delete format '{{displayName}}'"></a></td>
	</tr>
	{{/formats}}`;

	this.html(Mustache.render(template, {
		formats: newFormats,
	}));
}});

createHandler({selector: 'select[data-autoupdate="format"]', event: DataEvent.FORMATS_REFRESH, handler(newFormats) {
	const showNonConfigBased = this.data('filter') !== 'configBased';

	newFormats = newFormats.filter(function(format) {
		return showNonConfigBased || format.configurationBased;
	});

	const template = `
	{{#userFormats.0}}
	<optgroup label="{{userName}}">
		{{#userFormats}}
		<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>
		{{/userFormats}}
	</optgroup>
	{{/userFormats.0}}
	<optgroup label="Presets">
		{{#builtinFormats}}
		<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>
		{{/builtinFormats}}
	</optgroup>`;

	this
		.html(Mustache.render(template, {
			userName: serverInfo.user.id,
			builtinFormats: newFormats.filter(f => !f.owner && (f.isVisible == null /* temporary, for when bls does not support the property yet */ || f.isVisible)),
			userFormats: newFormats.filter(f => !!f.owner) // Always show user's own formats, even if isVisible == false
		}))
		.selectpicker('refresh')
		.trigger('change');
}});

createHandler({selector: 'tbody[data-autoupdate="corpora"]', event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	const filter = this.data('filter');

	if (filter === 'public') {
		newCorpora = newCorpora.filter(corpus => !corpus.owner);
	} else if (filter === 'private') {
		newCorpora = newCorpora.filter(corpus => !!corpus.owner);
	}

	// generate some data we need for rendering
	const viewcorpora = newCorpora.map(function(corpus) {
		let statusText: string = corpus.status;
		if (statusText === 'indexing') {
			statusText = ' (indexing) - ' + corpus.indexProgress!.filesProcessed + ' files, ' +
				corpus.indexProgress!.docsDone + ' documents, and ' +
				corpus.indexProgress!.tokensProcessed + ' tokens indexed so far...';
		} else if (corpus.status !== 'available') {
			statusText = ' (' + statusText + ')';
		} else  {
			statusText = '';
		}

		const format = formats.find(f => f.id === corpus.documentFormat);

		return {
			...corpus,
			canSearch: corpus.status === 'available',
			detailsId: corpus.id.replace(/[^\w]/g, '_') + '-details',
			documentFormatShortId: format ? format.shortId : '',
			documentFormatOwner: format ? format.owner : '',
			isUserFormat: format ? !!format.owner : false,
			isPrivate: !!corpus.owner,
			searchUrl: CONTEXT_URL + '/' + corpus.id + '/search/',
			sizeString: abbrNumber(corpus.tokenCount),
			statusText,
			timeModified: dateOnly(corpus.timeModified),
			timeModifiedFull: corpus.timeModified
		};
	});

	const template =
	`{{#corpora}}
	<tr>
		<td><a title="Search the '{{displayName}}' corpus" class="icon fa fa-search {{^canSearch}}disabled{{/canSearch}}" {{#canSearch}}href="{{searchUrl}}"{{/canSearch}}></a></td>
		<td class="corpus-name"><a title="Search the '{{displayName}}' corpus" class="{{^canSearch}}disabled{{/canSearch}}" {{#canSearch}}href="{{searchUrl}}"{{/canSearch}}>{{displayName}} {{statusText}}</a></td>
		<td>{{sizeString}}</td>
		{{#isPrivate}}
			<td><a role="button" data-corpus-action="upload" data-id="{{id}}" title="Upload documents to the '{{displayName}}' corpus" class="icon fa fa-fw fa-plus-square {{#isBusy}}disabled{{/isBusy}}"></a></td>
			<td><a role="button" data-corpus-action="share" data-id="{{id}}" title="Share the '{{displayName}}' corpus" class="icon fa fa-fw fa-user-plus"></a></td>
			<td><a role="button" data-corpus-action="delete" data-id="{{id}}" title="Delete the '{{displayName}}' corpus" class="icon fa fa-fw fa-trash {{#isBusy}}disabled{{/isBusy}}"></a></td>
		{{/isPrivate}}
		<td>
			<a role="button" data-toggle="collapse" href="#{{detailsId}}" aria-expanded="false" aria-controls="{{detailsId}}">
				<span class="icon fa fa-fw fa-caret-down" title="show details"></span>
			</a>
		</td>
	</tr>
	<tr id="{{detailsId}}" class="collapse">
		<td colspan="{{^isPrivate}}4{{/isPrivate}}{{#isPrivate}}7{{/isPrivate}}">
			<table>
				<tr title="{{timeModifiedFull}}">
					<th>Last modified</th>
					<td>{{timeModified}}</td>
				</tr>
				{{#isPrivate}}
				<tr>
					<th>Format</th>
					<td {{#isUserFormat}}title="Format owned by {{documentFormatOwner}}"{{/isUserFormat}}>{{#isUserFormat}}*{{/isUserFormat}}{{documentFormatShortId}}</td>
				</tr>
				{{/isPrivate}}
				<tr>
					<th>Description</th>
					<td>{{description}}</td>
				</tr>
			</table>
		</td>
	</tr>
	{{/corpora}}`;

	this.html(Mustache.render(template, {
		corpora: viewcorpora
	}));
}});

$('#corpora-private-container').on('click', '*[data-corpus-action="delete"]:not(.disabled)', function deleteCorpus(event) {
	event.preventDefault();
	event.stopPropagation();

	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		return;
	}

	confirmDialog(
		'Delete corpus?',
		'You are about to delete corpus <b>' + corpus.displayName + '</b>. <i class="text-danger">This cannot be undone!</i> <br><br>Are you sure?',
		'Delete',
		function ok() {
			$('#waitDisplay').show();
			Api.blacklab.deleteCorpus(corpusId)
				.then(() => {
					$('#waitDisplay').hide();
					showSuccess('Corpus "' + corpus.displayName + '" deleted.');
					refreshCorporaList();
				})
				.catch(showXHRError('Could not delete corpus "' + corpus.displayName + '"', () => $('#waitDisplay').hide()));
		}
	);
});

$('#corpora-private-container').on('click', '*[data-corpus-action="upload"]:not(.disabled)', function showUploadForm(event) {
	event.preventDefault();
	event.stopPropagation();
	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		return;
	}

	const format = formats.find(f => f.id === corpus.documentFormat);

	$('#uploadCorpusName').text(corpus.displayName);
	$('#uploadFormat').text(corpus.documentFormat + ' ');
	$('#uploadFormatDescription').text(format ? (format.description ||'') : 'Unknown format (it may have been deleted from the server), uploads might fail');

	// clear selected files
	$('#document-upload-form input[type="file"]').each(function() { $(this).val(''); }).trigger('change');

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
	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		showError('Unknown corpus, please refresh the page.'); // should never happen (except maybe before page is fully loaded) but whatever
		return;
	}

	Api.blacklab.getShares(corpusId)
		.then(shares => {
			$('#share-corpus-editor').val(shares.join('\n'));
			$('#share-corpus-form').data('corpus', corpus);
			$('#share-corpus-name').text(corpus.displayName);
			$('#share-corpus-modal').modal('show');
		})
		.catch(showXHRError('Could not retrieve share list for corpus "' + corpus.displayName + '"'));
});

$('#share-corpus-form').on('submit', function(event) {
	event.preventDefault();

	const corpus = $(this).data('corpus');
	const $modal = $('#share-corpus-modal');
	const $editor = $('#share-corpus-editor');
	const users = ($editor.val() as string).trim().split(/\s*[\r\n]+\s*/g); // split on line breaks, ignore empty lines.

	Api.blacklab.postShares(corpus.id, users)
		.then(data => showSuccess(data.status.message))
		.catch(showXHRError('Could not share corpus "' + corpus.displayName + '"'))
		.finally(() => {
			$editor.val('');
			$modal.modal('hide');
		});
});

// Abbreviate a number, i.e. 3426 becomes 3,4K,
// 2695798 becomes 2,6M, etc.
function abbrNumber(n: number|null|undefined) {
	if (n == null) {
		return '';
	}
	let unit = '';
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
function dateOnly(dateTimeString: string) {
	if (dateTimeString) {
		return dateTimeString.replace(/^(\d+)-(\d+)-(\d+) .*$/, '$3-$2-$1');
	} else {
		return '01-01-1970';
	}
}

/**
 * Keep requesting the status of the current index until it's no longer indexing.
 * The update handler will be called periodically while the status is "indexing", and then once more when the status has changed to something other than "indexing".
 *
 * @param indexId full id including any username
 */
async function refreshIndexStatusWhileIndexing(indexId: string) {
	let index = corpora.find(c => c.id === indexId)!;
	try {
		while (true) {
			index = await Api.blacklab.getCorpusStatus(indexId);
			triggers.updateCorpus(index);
			if (index.status !== 'indexing') return;
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
	} catch (error) {
		showXHRError(`Could not retrieve status for corpus "${index.displayName}"`)(error);
	}
}

// Request the list of available corpora and
// update the corpora page with it.
function refreshCorporaList() {
	// Perform the AJAX request to get the list of corpora.
	$('#waitDisplay').show();

	return Api.blacklab.getCorpora()
	.then(corpora => {
		triggers.updateCorpora(corpora);
		corpora
			.filter(corpus => corpus.status === 'indexing')
			.forEach(corpus => refreshIndexStatusWhileIndexing(corpus.id));
	})
	.catch(showXHRError('Could not retrieve corpora'))
	.finally(() => $('#waitDisplay').hide());
}

function refreshServerInfo() {
	return Api.blacklab.getServerInfo().then(triggers.updateServer).catch(showXHRError('Could not retrieve server info'));
}

function refreshFormatList() {
	return Api.blacklab.getFormats()
	.then(formats => triggers.updateFormats(formats.sort((a, b) => a.displayName.localeCompare(b.displayName)))) // sort alphabetically.
	.catch(showXHRError('Could not retrieve formats'));
}

// Get the currently logged-in user, or the empty string if no user is logged in.
function getUserId() {
	return serverInfo.user.loggedIn ? serverInfo.user.id : '';
}

// Show success message at the top of the page.
function showSuccess(msg: string) {
	$('#errorDiv').hide();
	$('#successMessage').html(msg);
	$('#successDiv').show();
	$('html, body').animate({
		scrollTop: $('#successDiv').offset()!.top - 75 // navbar
	}, 500);
}

// Show error at the top of the page.
function showError(msg: string) {
	$('#successDiv').hide();
	$('#errorMessage').html(msg).show();
	$('#errorDiv').show();
	$('html, body').animate({
		scrollTop: $('#errorDiv').offset()!.top - 75 // navbar
	}, 500);
}

function showXHRError(message: string, callback?: () => void): ((error: Api.ApiError) => void) {
	return function(error: Api.ApiError) {
		showError(message + ': ' + error.message);
		if (callback) callback();
		console.log(error);
	};
}

/**
 *  Create the specified index in the private user area.
 *
 *  @param displayName Name to show for the index
 *  @param shortName Internal, technical name that uniquely identifies the index for this user
 *  @param format Name of the format type for the documents in the index
 */
function createIndex(displayName: string, shortName: string, format: string) {
	if (!shortName || !displayName) return;

	// Prefix the user name because it's a private index
	const indexName = getUserId() + ':' + shortName;

	// Create the index.
	$('#waitDisplay').show();
	Api.blacklab
	.postCorpus(indexName, displayName, format)
	.then(() => {
		refreshCorporaList();
		showSuccess('Corpus "' + displayName + '" created.');
	})
	.catch(showXHRError('Could not create corpus "' + shortName + '"'))
	.finally(() => $('#waitDisplay').hide());
}

createHandler({selector: '#uploadProgress', event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	const displayedCorpusId = this.data('corpus-id');
	if (!displayedCorpusId) {
		return;
	}

	const corpus = newCorpora.find(c => c.id === displayedCorpusId);
	if (!corpus) {
		return;
	}

	let statusText = '';
	if (corpus.status === 'indexing') {
		statusText = 'Indexing in progress... - '
		+ corpus.indexProgress!.filesProcessed + ' files, '
		+ corpus.indexProgress!.docsDone + ' documents, and '
		+ corpus.indexProgress!.tokensProcessed + ' tokens indexed so far...';
	} else {
		statusText = 'Finished indexing!';
		this.toggleClass('indexing', false);
	}
	this.text(statusText);
}});

// What corpus are we uploading data to?
// TODO not very tidy
let uploadToCorpus: AppTypes.NormalizedIndexBase;

function initFileUpload() {

	const $modal = $('#upload-file-dialog');

	const $progress = $('#uploadProgress');
	const $success = $('#uploadSuccessDiv');
	const $error = $('#uploadErrorDiv');

	const $form = $('#document-upload-form');
	const $fileInputs = $form.find('input[type="file"]') as JQuery<HTMLInputElement>;

	$fileInputs.each(function() {
		const $this = $(this);
		$this.on('change', function() {
			let text;
			if (this.files && this.files.length) {
				text = this.files.length + $this.data('labelWithValue');
			} else {
				text = $this.data('labelWithoutValue');
			}

			$($this.data('labelId')).text(text);
		});
	}).trigger('change'); // init labels

	function preventModalCloseEvent(event: JQuery.Event) {
		event.preventDefault();
		event.stopPropagation();
		return false;
	}

	function handleUploadProgress(event: number): void {
		const progress = event;
		$progress
			.text('Uploading... (' +  Math.floor(progress) + '%)')
			.css('width', progress + '%')
			.attr('aria-valuenow', progress);

		if (event === 100) {
			handleUploadComplete();
		}
	}

	function handleUploadComplete() {
		$progress
			.css('width', '')
			.toggleClass('indexing', true)
			.text('indexing...')
			.data('corpus-id', uploadToCorpus.id);

		refreshIndexStatusWhileIndexing(uploadToCorpus.id);
	}

	function handleIndexingComplete() {
		const message = 'Data added to "' + uploadToCorpus.displayName + '".';

		$modal.off('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', false);
		$progress.toggleClass('indexing', false).parent().hide();
		$form.show();
		$error.hide();
		$success.text(message).show();

		// clear values
		$fileInputs.each(function() {
			$(this).val('').trigger('change');
		});
	}

	function handleError(error: Api.ApiError /*this: XMLHttpRequest, event*/) {
		const msg = error.message;

		$modal.off('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', false);
		$progress.toggleClass('indexing', false).parent().hide();
		$form.show();
		$success.hide();
		$error.text(msg).show();
	}

	$form.on('submit', function(event) {
		event.preventDefault();

		$modal.on('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', true);
		$form.hide();
		$error.hide();
		$success.hide();
		$progress
			.text('Connecting...')
			.css('width', '0%')
			.parent().show();

		const documentFiles = ($modal.find('#upload-docs-input')[0] as HTMLInputElement).files;
		const metadataFiles = ($modal.find('#upload-metadata-input')[0] as HTMLInputElement).files;

		const {request, cancel} = Api.blacklab.postDocuments(
			uploadToCorpus.id,
			Array.from(documentFiles!),
			Array.from(metadataFiles!),
			handleUploadProgress,
		);

		request.then(r => handleIndexingComplete).catch(handleError);

		return false;
	});
}

function initNewCorpus() {
	const $newCorpusModal = $('#new-corpus-modal');
	const $corpusNameInput = $('#corpus_name');
	const $corpusFormatSelect = $('#corpus_document_type');
	const $corpusFormatDescription = $('#corpus_document_type_description');
	const $corpusFormatHelpUrl = $('#corpus_document_type_help_url');
	const $saveButton = $('#new-corpus-modal .btn-primary');

	$newCorpusModal.on('shown.bs.modal', function(/*event*/) {
		$corpusNameInput.val('');
		$saveButton.prop('disabled', true);
		$corpusNameInput[0].focus();
	});
	$corpusNameInput.on('change, input', function(/*event*/) {
		$saveButton.prop('disabled', ($(this).val() as string).length <= 2);
	});
	// Enable submit through pressing the 'enter' key while a form element has the focus
	$('input, select', $newCorpusModal).on('keydown', function(event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			if (!$saveButton.prop('disabled')) {
				$saveButton.click();
			}
		}
	});
	$saveButton.on('click', function(event) {
		event.preventDefault();
		if ($(this).prop('disabled')) {
			return;
		}

		const corpusName = $corpusNameInput.val() as string;
		const format = $corpusFormatSelect.val() as string;
		$newCorpusModal.modal('hide');
		createIndex(corpusName, generateShortName(corpusName), format);
	});

	$corpusFormatSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
		const formatId = $(this).selectpicker('val');
		const format = formats.find(f => f.id === formatId)!;
		// format always exists if it's present in the select to begin with

		$corpusFormatDescription.text(format.description as string);
		if (format.helpUrl) {
			$corpusFormatHelpUrl.attr('href', format.helpUrl).show();
		} else {
			$corpusFormatHelpUrl.removeAttr('href').hide();
		}
	});
}

/**
 * Show a dialog with custom message, title, and confirm button html
 * Call a callback, only if the confirm button is pressed.
 *
 * @param title
 * @param message
 * @param buttontext
 * @param fnCallback
 */
const confirmDialog = (function() {
	const $modal = $('#modal-confirm');
	const $confirmButton = $modal.find('#modal-confirm-confirm');
	const $title = $modal.find('#modal-confirm-title');
	const $message = $modal.find('#modal-confirm-message');

	return function(title: string, message: string, buttontext: string, fnCallback: () => void) {
		$title.html(title);
		$message.html(message);
		$confirmButton.html(buttontext);

		$modal.modal('show');
		$modal.one('hide.bs.modal', function() {
			if (document.activeElement === $confirmButton[0]) {
				fnCallback();
			}
		});
	};
})();

function generateShortName(name: string) {
	return name.replace(/[^\w]/g, '-').replace(/^[_\d]+/, '');
}

function initNewFormat() {
	const $modal = $('#new-format-modal');

	const $fileInput = $('#format_file') as JQuery<HTMLInputElement>;
	const $presetSelect = $('#format_select');
	const $presetInput = $('#format_preset');
	const $downloadButton = $('#format_download');

	const $formatName = $('#format_name');
	const $formatType = $('#format_type');
	const editor = CodeMirror.fromTextArea($('#format_editor')[0] as HTMLTextAreaElement, {
		mode: 'yaml',
		lineNumbers: true,

		viewportMargin: 100 // render 100 lines above and below the visible editor window
	});

	const $confirmButton = $('#format_save');

	function showFormatError(text: string) {
		$('#format_error').text(text).show();
	}
	function hideFormatError() {
		$('#format_error').hide();
	}

	function uploadFormat(name: string, contents: string) {
		Api.blacklab.postFormat(name, contents)
		.then(data => {
			$modal.modal('hide');
			$formatName.val('');
			editor.setValue('');

			refreshFormatList();
			showSuccess(data.status.message);
		})
		.catch((e: Api.ApiError) => showFormatError(e.message));
	}

	// Required to fix line-number display width being calculated incorrectly
	// (something to do with initializing the editor when the element is invisible or has width 0)
	$modal.on('shown.bs.modal', () => editor.refresh());
	$modal.on('hidden.bs.modal', hideFormatError);

	$presetInput.val($presetSelect.selectpicker('val')); // init with current value
	$presetSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
		$presetInput.val($presetSelect.selectpicker('val'));
	});

	$formatType.on('change', function() {
		const newMode = $(this).selectpicker('val');
		editor.setOption('mode', newMode === 'json' ? {name: 'javascript', json: true} : newMode);
	});

	$fileInput.on('change', function() {
		if (this.files && this.files[0] != null) {
			const file = this.files[0];
			const fr = new FileReader();
			const self = this;

			fr.onload = function() {
				editor.setValue(fr.result as string);
				self.value = '';
			};
			fr.readAsText(file);
		}
	});

	$downloadButton.on('click', function() {
		const $this = $(this);
		const presetName = $presetInput.val() as string;

		if (!presetName || $this.prop('disabled')) {
			return;
		}

		$this.prop('disabled', true).append('<span class="fa fa-spinner fa-spin"></span>');
		hideFormatError();
		Api.blacklab.getFormatContent(presetName)
		.then(data => {
			let configFileType = data.configFileType.toLowerCase();
			if (configFileType === 'yml') {
				configFileType = 'yaml';
			}

			$formatType.selectpicker('val', configFileType);
			$formatType.trigger('change');
			editor.setValue(data.configFile);

			// is a user-owned format and no name for the format has been given yet
			// set the format name to this format so the user can easily save over it
			if (!$formatName.val() && presetName.indexOf(':') > 0) {
				$formatName.val(presetName.substr(presetName.indexOf(':')+1));
			}

			$this.closest('.collapse').collapse('hide');
		})
		.catch((e: Api.ApiError) => showFormatError(e.message))
		.finally(() => $this.prop('disabled', false).find('.fa-spinner').remove());
	});

	$confirmButton.on('click', function() {
		if (!$formatName.val()) {
			showFormatError('Please enter a name.');
			return;
		}

		const fileContents = editor.getValue();
		const fileName = $formatName.val() + '.blf.' + $formatType.selectpicker('val');
		uploadFormat(fileName, fileContents);
	});
}

function initDeleteFormat() {

	$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="delete"]', function(event) {
		event.preventDefault();

		const formatId = $(this).data('format-id');

		confirmDialog(
			'Delete import format?',
			'You are about to delete the import format <i>' + formatId + '</i>.<br>Are you sure?',
			'Delete',
			() => Api.blacklab
				.deleteFormat(formatId)
				.then(data => {
					showSuccess(data.status.message);
					refreshFormatList();
				})
				.catch(showXHRError('Could not delete format')),
		);
	});
}

function initEditFormat() {
	$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="edit"]', function(event) {
		event.preventDefault();
		const formatId = $(this).data('format-id');

		const $modal = $('#new-format-modal');
		const $presetSelect = $('#format_select');
		const $downloadButton = $('#format_download');
		const $formatName = $('#format_name');
		// formattype determined after download succeeds

		$presetSelect.selectpicker('val', formatId).trigger('change');
		$downloadButton.click();
		$formatName.val(formatId.substr(Math.max(formatId.indexOf(':')+1, 0))); // strip username portion from formatId as username:formatname, if preset

		$modal.modal('show');
	});
}

$(document).ready(async function() {
	const user = await loginsystem.awaitInit();
	Api.init('blacklab', BLS_URL, user);
	Api.init('cf', CONTEXT_URL, user);

	console.log('loading corpora?');
	// Get the list of corpora.
	await refreshServerInfo(); // server info needed before we can get other information
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
