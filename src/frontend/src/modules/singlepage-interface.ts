/* global BLS_URL, PROPS_IN_COLUMNS */

import 'bootstrap';
import 'bootstrap-select';
import {saveAs} from 'file-saver';
import * as $ from 'jquery';
import * as URI from 'urijs';

import {onSearchUpdated} from '../search';
import {debugLog} from '../utils/debug';
import {getBlsParam, getQuerySummary, search} from './singlepage-bls';

import * as BLTypes from '../types/blacklabtypes';

// TODO
// showCitation showProperties onClick handlers

/**
 * Responsible for converting search results to html.
 * Also contains functions to clear old results from the page.
 * Does not manage the main search form.
 */

/**
 * Dictionary where key == propertyId and value is array of containing the values for that id, in order of occurance.
 * Available properties are contained in SINGLEPAGE.INDEX.complexFields['complexFieldId'].properties['propertyId']
 * NOTE: since blacklab 2.0, properties are called annotations and are contained in SINGLEPAGE.INDEX.annotatedFields['id'].annotations['id']
 *
 * The 'punct' property is always available.
 */
type BLHitContext = {
	punct: string[];
	[key: string]: string[];
};

type BLHit = {
	docPid: string;
	start: number;
	end: number;
	left: BLHitContext;
	match: BLHitContext;
	right: BLHitContext;
};

type Property = {
	id: string;
	displayName: string;
	isMainProp: boolean;
};

declare var PROPS_IN_COLUMNS: string[];
declare var SINGLEPAGE: {INDEX: any};
declare var BLS_URL: string;

const ELLIPSIS = String.fromCharCode(8230);

const PROPS: {all?: Property[], shown?: Property[], firstMainProp?: Property } = {};
// Gather up all relevant properties of words in this index
PROPS.all = $.map(SINGLEPAGE.INDEX.complexFields || SINGLEPAGE.INDEX.annotatedFields, function(complexField) {
	return $.map(complexField.properties || complexField.annotations, function(prop, propId) {
		if (prop.isInternal) {
			return null;
		} // skip prop
		return {
			id: propId,
			displayName: prop.displayName || propId,
			isMainProp: propId === complexField.mainProperty
		} as Property;
	});
});

/** Columns configured in PROPS_IN_COLUMNS, can contain duplicates */
PROPS.shown = $.map(PROPS_IN_COLUMNS, function(propId) {
	return $.map(PROPS.all, function(prop) {
		return (prop.id === propId) ? prop : undefined;
	});
});

// There is always at least a single main property.
// TODO this shouldn't be required, mainProperties from multiple complexFields should be handled properly
// but this has some challenges in the hits table view, such as that it would show multiple columns for the before/hit/after contexts
PROPS.firstMainProp = PROPS.all.filter(function(prop) { return prop.isMainProp; })[0];

// Add a 'hide' function to bootstrap tabs
// Doesn't do more than remove classes and aria labels, and fire some events
($.fn.tab as any).Constructor.prototype.hide = function() {
	const $this    = this.element;
	const selector = $this.data('target') || $this.attr('href');

	const hideEvent = $.Event('hide.bs.tab', {
		relatedTarget: $this[0]
	});

	$this.trigger(hideEvent);
	if (hideEvent.isDefaultPrevented()) {
		return this;
	}

	$this.closest('li.active')
		.removeClass('active')
		.attr('aria-expanded', false)
		.trigger({
			type: 'hidden.bs.tab',
			relatedTarget: this[0]
		});
	$(selector).removeClass('active');
	return this;
};

/**
 * @param {BLHitContext} context
 * @param {string} prop - property to retrieve
 * @param {boolean} doPunctBefore - add the leading punctuation?
 * @param {string} addPunctAfter - trailing punctuation to append
 * @returns {string} concatenated values of the property, interleaved with punctuation from context['punt']
 */
function words(context, prop, doPunctBefore, addPunctAfter) {
	const parts = [];
	const n = context[prop] ? context[prop].length : 0;
	for (let i = 0; i < n; i++) {
		if ((i === 0 && doPunctBefore) || i > 0) {
			parts.push(context.punct[i]);
		}
		parts.push(context[prop][i]);
	}
	parts.push(addPunctAfter);
	return parts.join('');
}

/**
 * @param {BLHit} hit - the hit
 * @param {string} [prop] - property of the context to retrieve, defaults to PROPS.firstMainProp (usually 'word')
 * @returns {Array.<string>} - string[3] where [0] == before, [1] == hit and [2] == after, values are strings created by
 * concatenating and alternating the punctuation and values itself
 */
function snippetParts(hit, prop?: string) {
	prop = prop || PROPS.firstMainProp.id;

	const punctAfterLeft = hit.match.word.length > 0 ? hit.match.punct[0] : '';
	const before = words(hit.left, prop, false, punctAfterLeft);
	const match = words(hit.match, prop, false, '');
	const after = words(hit.right, prop, true, '');
	return [before, match, after];
}

/**
 * Concat all properties in the context into a large string
 *
 * @param {BLHitContext} context
 * @returns {string}
 */
function properties(context) {
	const props = [];
	for (const key in context) {
		if (context.hasOwnProperty(key)) {
			const val = $.trim(context[key]);
			if (!val) { continue; }
			props.push(key+': '+val);
		}
	}
	return props.join(', ');
}

/**
 * Fade out the table, then replace its contents, and call a function.
 *
 * @param {object} $table
 * @param {string} html Table head and body
 * @param {function} [onComplete] callback, will be called in the context of $table
 */
function replaceTableContent($table, html, onComplete?: ($table: JQuery<HTMLElement>) => void) {
	// skip the fadeout if the table is empty
	// fixes annoying mini-delay when first viewing results
	const fadeOutTime = $table.find('tr').length ? 200 : 0;

	$table.animate({opacity: 0}, fadeOutTime, function() {
		$table.html(html);
		if (onComplete) {
			onComplete.call($table);
		}
		$table.animate({opacity: 1}, 200);
	});
}

/**
 * Show the error reporting field and display any errors that occured when performing a search.
 *
 * Can be directly used as callback fuction to $.ajax
 *
 * @param {any} jqXHR
 * @param {any} textStatus
 * @param {any} errorThrown
 */
function showBlsError(jqXHR, textStatus, errorThrown) {
	const errordata = (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) || {
		code: 'WEBSERVICE_ERROR',
		message: 'Error contacting webservice: ' + textStatus + '; ' + errorThrown
	};

	$('#errorDiv').text(errordata.message + ' (' + errordata.code + ') ').show();
}

/**
 * Hide the error field.
 */
function hideBlsError() {
	$('#errorDiv').text('(error here)').hide();
}

/**
 * Create pagination buttons based on a set of results.
 *
 * Buttons contain a data-page attribute containing the page index they're displaying - 1.
 *
 * @param {any} $pagination <ul> element where the generated pagination will be placed.
 * @param {any} data a blacklab-server search response containing either groups, docs, or hits.
 */
function updatePagination($pagination, data) {
	let beginIndex = data.summary.windowFirstResult;
	const pageSize = data.summary.requestedWindowSize;
	let totalResults;
	if (data.summary.numberOfGroups != null) {
		totalResults = data.summary.numberOfGroups;
	}
	else {
		totalResults = (data.hits ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved);
	}

	// when out of bounds results, draw at least the last few pages so the user can go back
	if (totalResults < beginIndex) {
		beginIndex = totalResults+1;
	}

	const totalPages =  Math.ceil(totalResults / pageSize);
	const currentPage = Math.ceil(beginIndex / pageSize);
	const startPage = Math.max(currentPage - 10, 0);
	const endPage = Math.min(currentPage + 10, totalPages);

	const html = [];
	if (currentPage === 0) {
		html.push('<li class="disabled"><a>Prev</a></li>');
	}
	else {
		html.push('<li><a href="javascript:void(0)" data-page="', currentPage-1, '">Prev</a></li>');
	}

	if (startPage > 0) {
		html.push('<li class="disabled"><a>...</a></li>');
	}

	for (let i = startPage; i < endPage; i++) {
		const showPageNumber = i + 1;
		if (i === currentPage) {
			html.push('<li class="active"><a>', showPageNumber, '</a></li>');
		}
		else {
			html.push('<li><a href="javascript:void(0)" data-page="', i, '">', showPageNumber, '</a></li>');
		}
	}

	if (endPage < totalPages) {
		html.push('<li class="disabled"><a>...</a></li>');
	}

	if (currentPage === (totalPages - 1) || totalPages === 0) {
		html.push('<li class="disabled"><a>Next</a></li>');
	}
	else {
		html.push('<li><a href="javascript:void(0)" data-page="', currentPage + 1, '">Next</a></li>');
	}

	$pagination.html(html.join(''));
}

/**
 * After a small delay, clear the tab's current data and show a spinner.
 *
 * The delay exists because it's jarring when the user switches page and all content is removed
 * and then displayed again within a fraction of a second.
 *
 * @param {any} $tab the tab content container.
 */
function showSearchIndicator($tab) {
	if ($tab.data('searchIndicatorTimeout') == null) {
		$tab.data('searchIndicatorTimeout', setTimeout(function() {
			$tab.find('.searchIndicator').show();
			clearTabResults($tab);
		}, 500));
	}
}

/**
 * Hide any currently displayed spinner within this tab, and remove any queued spinner (see showSearchIndicator).
 *
 * @param {any} $tab the tab's main content container.
 */
function hideSearchIndicator($tab) {
	if ($tab.data('searchIndicatorTimeout') != null) {
		clearTimeout($tab.data('searchIndicatorTimeout'));
		$tab.removeData('searchIndicatorTimeout');
	}
	$tab.find('.searchIndicator').hide();
}

/**
 * Load and display results within a specific group of documents/hits.
 *
 * This function should only be called when the containing tab currently has a groupBy clause,
 * otherwise an invalid search will be generated.
 *
 * This function assumes it's being called in the context of a button/element containing a data-group-id attribute
 * specifiying a valid group id.
 */
function viewConcordances() {
	const $button = $(this);
	const groupId = $button.data('groupId');

	// this parameter is local to this tab, as the other tabs are probably displaying other groups.
	$(this).trigger('localParameterChange', {
		viewGroup: groupId,
		page: 0,
		sort: null,
	});

	// initialize the display indicating we're looking at a detailed group

	// Only set the text, don't show it yet
	// (it should always be hidden, as this function is only available/called when you're not currently viewing contents of a group)
	// This is a brittle solution, but better than nothing for now.
	// TODO when blacklab-server echoes this data in the search request, set these values in setTabResults() and remove this here
	const groupName = $button.data('groupName');
	const $tab = $button.closest('.tab-pane');
	const $resultgroupdetails = $tab.find('.resultgroupdetails');
	const $resultgroupname = $resultgroupdetails.find('.resultgroupname');
	$resultgroupname.text(groupName || '');
}

/**
 * Loads and displays a small amount of details about individual hits/documents within a specific group.
 * Some data is attached to the button to track how many concordances are already loaded/are available.
 *
 * This function does not refresh the entire tab's contents, just inserts some extra data within a group's <tr>
 * For the version that loads the full result set and displays the extensive information, see {@link viewConcordances}
 *
 * This function assumes it's being called within the context of a button element containing a data-group-id attribute.
 * Some assumptions are also made about the exact structure of the document regarding placement of the results.
 */
function loadConcordances() {
	const $button = $(this);
	const $tab = $button.parents('.tab-pane').first();
	const textDirection = SINGLEPAGE.INDEX.textDirection || 'ltr';
	const groupId = $button.data('groupId');
	const currentConcordanceCount = $button.data('currentConcordanceCount') || 0;
	const availableConcordanceCount = $button.data('availableConcordanceCount') || Number.MAX_VALUE;

	if (currentConcordanceCount >= availableConcordanceCount) {
		return;
	}

	const searchParams = $.extend(
		{},
		$tab.data('defaultParameters'),
		$tab.data('parameters'),
		{
			pageSize: 20,
			page: currentConcordanceCount / 20,
			viewGroup: groupId,
			sampleSize: null,
			sampleMode: null,
			sampleSeed: null,
			sort: null
		},
		$tab.data('constParameters')
	);

	search(searchParams, function(data) {
		const totalConcordances = data.hits ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved;
		const loadedConcordances = data.summary.actualWindowSize;

		// store new number of loaded elements
		$button.data('currentConcordanceCount', currentConcordanceCount + loadedConcordances)
			.data('availableConcordanceCount', totalConcordances)
			.toggle(currentConcordanceCount + loadedConcordances < totalConcordances);

		// And generate html to display
		const html = [];
		// Only one of these will run depending on what is present in the data
		// And what is present in the data depends on the current view, so all works out
		$.each(data.hits, function(index, hit) {
			const parts = snippetParts(hit);
			const left = textDirection==='ltr'? parts[0] : parts[2];
			const right = textDirection==='ltr'? parts[2] : parts[0];
			html.push(
				'<div class="clearfix">',
					'<div class="col-xs-5 text-right">', ELLIPSIS, ' ', left, '</div>',
					'<div class="col-xs-2 text-center"><b>', parts[1], '&nbsp;', '</b></div>',
					'<div class="col-xs-5">', right, ' ', ELLIPSIS, '</div>',
				'</div>');
		});

		$.each(data.docs, function(index, doc) {
			const title = doc.docInfo[data.summary.docFields.titleField];
			const hits = doc.numberOfHits;
			html.push(
				'<div class="clearfix">',
					'<div class="col-xs-10"><b>', title, '&nbsp;', '</b></div>',
					'<div class="col-xs-2">', hits, '&nbsp;', '</div>',
				'</div>');
		});

		// TODO tidy up
		$button.parent().parent().append(html.join(''));
	},
	function(jqXHR, textStatus, errorThrown) {
		const errordata = (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) || {
			code: 'WEBSERVICE_ERROR',
			message: 'Error contacting webservice: ' + textStatus + '; ' + errorThrown
		};

		const html = [];
		html.push('<div>',
			'<b>Could not retrieve concordances.</b><br>');

		if (jqXHR && jqXHR.status !== 0) { // server is up
			html.push('This is usually due to a misconfigured server, see ',
				'<a href="https://github.com/INL/BlackLab/blob/be5b5be75c064e87cbfc2271fd19d073f80839af/core/src/site/markdown/blacklab-server-overview.md#installation" target="_blank">here</a> for more information.');
		}

		html.push('<hr><b>', errordata.code, '</b><br>', errordata.message, '</div>');

		// TODO tidy up
		$button.parent().parent().html(html.join(''));
	});
}

/**
 * Convert a blacklab-server reply containing information about hits into a table containing the results.
 *
 * @param {any} data the blacklab-server response.
 * @returns An array of html strings containing the <thead> and <tbody>, but without the enclosing <table> element.
 */
function formatHits(data, textDirection) {
	// TODO use mustache.js

	const html = [];
	/* eslint-disable indent */
	html.push(
		'<thead><tr>',
			'<th class="text-right" style="width:40px">',
				'<span class="dropdown">',
					'<a class="dropdown-toggle" data-toggle="dropdown">',
					textDirection==='ltr'? 'Before hit ' : 'After hit ',
					'<span class="caret"></span></a>',
					'<ul class="dropdown-menu" role="menu" aria-labelledby="left">');
	PROPS.all.forEach(function(prop) { html.push(
						'<li><a data-bls-sort="left:' + prop.id + '">' + prop.displayName + '</a></li>');
					});
	html.push(
					'</ul>',
				'</span>',
			'</th>',

			'<th class="text-center" style="width:20px;">',
				'<a data-bls-sort="hit:' + PROPS.firstMainProp.id + '"><strong>' + PROPS.firstMainProp.displayName + '<strong></a>',
			'</th>',

			'<th class="text-left" style="width:40px;">',
				'<span class="dropdown">', // span instead of div or the menu won't align with the toggle text, as the toggle container is wider than the toggle's text
					'<a class="dropdown-toggle" data-toggle="dropdown">',
					textDirection==='ltr'? 'After hit ' : 'Before hit ',
					'<span class="caret"></span></a>',
					'<ul class="dropdown-menu" role="menu" aria-labelledby="right">');
	PROPS.all.forEach(function(prop) { html.push(
						'<li><a data-bls-sort="right:' + prop.id + '">' + prop.displayName + '</a></li>');
					});
	html.push(
					'</ul>',
				'</span>',
			'</th>');

			// Not all properties have their own table columns
	PROPS.shown.forEach(function(prop) { html.push(
			'<th style="width:15px;"><a data-bls-sort="hit:' + prop.id + '">' + prop.displayName + '</a></th>');
			});
	html.push('</tr></thead>');
	/* eslint-enable */

	html.push('<tbody>');
	let prevHitDocPid = null;
	const numColumns = 3 + PROPS.shown.length; // before context - hit context - after context - remaining properties
	$.each(data.hits, function(index, hit) {
		// Render a row for this hit's document, if this hit occurred in a different document than the previous
		const docPid = hit.docPid;
		if (docPid !== prevHitDocPid) {
			prevHitDocPid = docPid;
			const doc = data.docInfos[docPid];
			const docTitle = doc[data.summary.docFields.titleField] || 'UNKNOWN';
			const docAuthor = doc[data.summary.docFields.authorField] ? ' by ' + doc[data.summary.docFields.authorField] : '';
			const docDate = doc[data.summary.docFields.dateField] ? ' (' + doc[data.summary.docFields.dateField] + ')' : '';

			// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
			// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
			// Have a configurable url in the backend that's made available on the client that we can use here.
			let docUrl;
			switch (new URI().filename()) {
			case '':
				docUrl = new URI('../../docs/');
				break;
			case 'docs':
			case 'hits':
				docUrl = new URI('../docs/');
				break;
			case 'search':
			default: // some weird proxy?
				docUrl = new URI('./docs/');
				break;
			}

			docUrl = docUrl
				.absoluteTo(new URI().toString())
				.filename(docPid)
				.search({
					// parameter 'query' controls the hits that are highlighted in the document when it's opened
					query: data.summary.searchParam.patt
				})
				.toString();

			// Display some info about the document
			html.push(
				'<tr>',
					'<td colspan="', numColumns, '"><div class="doctitle collapse in">',
						'<a class="text-error" target="_blank" href="', docUrl, '">', docTitle, docAuthor, docDate, '</a>',
					'</div></td>',
				'</tr>');
		}

		// And display the hit itself
		const parts = snippetParts(hit);
		const left = textDirection==='ltr'? parts[0] : parts[2];
		const right = textDirection==='ltr'? parts[2] : parts[0];
		const propsWord = properties(hit.match).replace("'","\\'").replace('&apos;',"\\'").replace('"', '&quot;');

		/* eslint-disable indent */
		html.push(
			'<tr class="concordance" onclick="SINGLEPAGE.INTERFACE.showCitation(this, \''
			+ docPid + '\', '+ hit.start + ', '+ hit.end + ', \'' + textDirection + '\');SINGLEPAGE.INTERFACE.showProperties(this, \''+propsWord+'\');">',
				'<td class="text-right">', ELLIPSIS, ' <span dir="', textDirection, '">', left, '</span></td>',
				'<td class="text-center"><span dir="', textDirection, '"><strong>', parts[1], '</strong></span></td>',
				'<td><span dir="', textDirection, '">', right, '</span> ', ELLIPSIS, '</td>');
		PROPS.shown.forEach(function(prop) { html.push(
					'<td>', words(hit.match, prop.id, false, ''), '</td>');
				});
		html.push(
			'</tr>');

		// Snippet row (initially hidden)
		html.push(
			'<tr>',
				'<td colspan="', numColumns, '" class="inline-concordance"><div class="collapse">Loading...</div></td>',
			'</tr>');
		// Properties row (initially hidden)
		html.push(
			'<tr>',
				'<td colspan="', numColumns, '" class="inline-concordance"><div class="collapse">Loading...</div></td>',
			'</tr>');
		/* eslint-enable */
	});

	html.push('</tbody>');
	return html;
}

/**
 * Convert a blacklab-server reply containing information about documents into a table containing the results.
 *
 * @param {any} data the blacklab-server response.
 * @returns An array of html strings containing the <thead> and <tbody>, but without the enclosing <table> element.
 */
function formatDocs(data, textDirection): string[] {
	const html = [];

	html.push(
		'<thead><tr>',
			'<th style="width:70%"><a data-bls-sort="field:', data.summary.docFields.titleField, '">Document title</a></th>',
			'<th style="width:15%"><a data-bls-sort="field:', data.summary.docFields.dateField, '">Year</a></th>',
			'<th style="width:15%"><a data-bls-sort="numhits">Hits</a></th>',
		'</tr></thead>'
	);

	html.push('<tbody>');
	$.each(data.docs, function(index, doc) {
		const docPid = doc.docPid;

		const docTitle = doc.docInfo[data.summary.docFields.titleField] || 'UNKNOWN';
		const docAuthor = doc.docInfo[data.summary.docFields.authorField] ? ' by ' + doc.docInfo[data.summary.docFields.authorField] : '';
		const docDate = doc.docInfo[data.summary.docFields.dateField] || '';
		const docHits = doc.numberOfHits || '';

		const snippetStrings = [];
		$.each(doc.snippets, function(index, snippet) {
			const parts = snippetParts(snippet);
			snippetStrings.push(ELLIPSIS, ' ', parts[0], '<strong>', parts[1], '</strong>', parts[2], ELLIPSIS);
			return false; // only need the first snippet for now
		});

		// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
		// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
		// Have a configurable url in the backend that's made available on the client that we can use here.
		let docUrl;
		switch (new URI().filename()) {
		case '':
			docUrl = new URI('../../docs/');
			break;
		case 'docs':
		case 'hits':
			docUrl = new URI('../docs/');
			break;
		case 'search':
		default: // some weird proxy?
			docUrl = new URI('./docs/');
			break;
		}

		docUrl = docUrl
			.absoluteTo(new URI().toString())
			.filename(docPid)
			.search({
				query: data.summary.searchParam.patt
			})
			.toString();

		html.push(
			'<tr class="documentrow">',
				'<td>',
					'<a target="_blank" href="', docUrl, '">', docTitle, docAuthor, '</a><br>', '<span dir="', textDirection, '">',
					snippetStrings.join(''), snippetStrings.length > 0 ? '<br>' : '', '</span>',
					'<a class="green btn btn-xs btn-default" target="_blank" href="', docUrl,'">View document info</a>',
				'</td>',
				'<td>', docDate, '</td>',
				'<td>', docHits, '</td>',
			'</tr>');
	});
	html.push('</tbody>');

	return html;
}

/**
 * Convert a blacklab-server reply containing information about hit or document groups into a table containing the results.
 * Some minor styling is applied based on whether the results are hits or documents.
 *
 * @param {any} data the blacklab-server response.
 * @returns An array of html strings containing the <thead> and <tbody>, but without the enclosing <table> element.
 */
function formatGroups(data) {
	const html = [];

	html.push(
		'<thead><tr>',
			'<th style="width:30%;"><a data-bls-sort="identity">Group</a></th>',
			'<th style="width:70%;"><a data-bls-sort="numhits">Hits</a></th>',
		'</tr></thead>'
	);

	// give the display a different color based on whether we're showing hits or docs
	const displayClass = data.hitGroups ? 'progress-bar-success' : 'progress-bar-warning';
	const idPrefix = data.hitGroups ? 'hg' : 'dg'; // hitgroup : docgroup

	html.push('<tbody>');
	const groups = data.hitGroups || data.docGroups;
	$.each(groups, function(index, group) {
		const groupId = group.identity;
		const htmlId = idPrefix + index;

		const displayName = group.identityDisplay;
		const displayWidth = (group.size / data.summary.largestGroupSize) * 100;

		html.push(
			'<tr>',
				'<td>', displayName, '</td>',
				'<td>',
					'<div class="progress group-size-indicator" data-toggle="collapse" data-target="#', htmlId, '" style="cursor:pointer;">',
						'<div class="progress-bar ', displayClass, '" style="min-width: ', displayWidth, '%;">', group.size, '</div>',
					'</div>',
					'<div class="collapse inline-concordance" id="', htmlId, '">',
						'<div>',
							'<button type="button" class="btn btn-sm btn-link viewconcordances" data-group-name="', displayName, '" data-group-id="', groupId, '">&#171; View detailed concordances in this group</button> - ',
							'<button type="button" class="btn btn-sm btn-link loadconcordances" data-group-id="', groupId, '">Load more concordances...</button>',
						'</div>',
					'</div>',
				'</td>',
			'</tr>');
	});
	html.push('</tbody>');

	return html;
}

/**
 * Request the currently shown results as a CSV file, and save it.
 *
 * 'this' should be the tab containing the results to export.
 * 'event.target' should be the element that was clicked.
 *
 * @param {Jquery.Event} event
 */
function onExportCsv(event) {
	const $tab = $(event.delegateTarget);

	const $button = $(event.target);
	if ($button.hasClass('disabled')) {
		return;
	}

	const pageParam = $.extend({},
		$tab.data('defaultParameters'),
		$tab.data('parameters'),
		$tab.data('constParameters'));

	const blsParam = getBlsParam(pageParam) as any;

	blsParam.outputformat = 'csv';
	delete blsParam.number;
	delete blsParam.first;

	const url = new URI(BLS_URL).segment(pageParam.operation).addSearch(blsParam).toString();
	debugLog('CSV download url', url, blsParam); // eslint-disable-line

	$button
		.addClass('disabled')
		.attr('disabled', true)
		.prepend('<span class="fa fa-spinner fa-spin"></span>');
	$.ajax(url, {
		accepts: {json: 'application/json'},
		cache: false,
		data: 'text',
		// error: function(jqXHR, textStatus, errorThrown) {

		// },
		success (data) {
			// NOTE: Excel <=2010 seems to ignore the BOM altogether, see https://stackoverflow.com/a/19516038
			const b = new Blob([data], { type: 'text/plain;charset=utf-8' });
			saveAs(b, 'data.csv'); // FileSaver.js
		},
		complete () {
			$button
				.removeClass('disabled')
				.attr('disabled', false)
				.find('.fa-spinner').remove();
		}
	});
}

/**
 * Redraws the table, pagination, hides spinners, shows/hides group indicator, shows the pagination/group controls, etc.
 *
 * @param {any} data the successful blacklab-server reply.
 */
function setTabResults(data) {
	const $tab = $(this);
	let html;
	const textDirection = SINGLEPAGE.INDEX.textDirection || 'ltr';
	// create the table
	if (data.hits && data.hits.length) {
		html = formatHits(data, textDirection);
	}
	else if (data.docs && data.docs.length) {
		html = formatDocs(data, textDirection);
						}
	else if ((data.hitGroups && data.hitGroups.length) || (data.docGroups && data.docGroups.length)) {
		html = formatGroups(data);
						}
	else {
		html = [
			'<thead>',
				'<tr><th><a>No results found</a></th></tr>',
			'</thead>',
			'<tbody>',
				'<tr>',
					'<td class="no-results-found">No results were found. Please check your query and try again.</td>',
				'</tr>',
			'</tbody>'
		];
	}

	function onTableContentsReplaced() {
		// first time opening the concordances for a group, load the first results
		$(this).find('.collapse').one('show.bs.collapse', function() {
			$(this).find('.loadconcordances').click();
		});
		$(this).find('.loadconcordances').on('click', loadConcordances);
		$(this).find('.viewconcordances').on('click', viewConcordances);
	}

	// Always do this, if an out-of-bounds request is made and no data is returned,
	// the pagination will still be accurate, allowing the user to go back to a valid page.
	updatePagination($tab.find('.pagination'), data);
	replaceTableContent($tab.find('.resultcontainer table'), html.join(''), onTableContentsReplaced);
	hideSearchIndicator($tab);
	$tab.find('.resultcontrols, .resultcontainer').show();
	$tab.data('results', data);

	// Hide/show the group view identifier and reset button
	// The values of these are set when the search is initiated in viewConcordances()
	// TODO when blacklab-server echoes the friendly name of the group, display that here and don't set any data
	// when initiating the search
	// TODO we set the value as fallback when no value currently set, as when first loading page, there was no initial search
	// where we know the group parameter.
	const $resultgroupdetails = $tab.find('.resultgroupdetails');
	if (data.summary.searchParam.viewgroup) {
		$resultgroupdetails.show();
		const $resultgroupname = $resultgroupdetails.find('.resultgroupname');
		if (!$resultgroupname.text()) {
			$resultgroupname.text(data.summary.searchParam.viewgroup);
		}
	} else {
		$resultgroupdetails.hide();
	}

	const showWarning = !!(data.summary.stoppedRetrievingHits && !data.summary.stillCounting);
	$tab.find('.results-incomplete-warning').toggle(showWarning);
}

/**
 * Clears displayed data, hides pagination, group indicator, group control, cached results, etc.
 *
 * @param {any} $tab
 */
function clearTabResults($tab) {
	$tab.find('.resultcontrols').hide();
	$tab.find('.resultcontainer').hide().find('table thead, table tbody').empty();
	$tab.find('.resultgroupdetails .resultgroupname').empty();
	$tab.removeData('results');
}

/**
 * Set new search parameters for this tab. Does not mark tab for refresh or remove existing data.
 *
 * NOTE: pagination is never updated based on parameters, but instead drawn based on search response.
 * @param {jquery} $tab - tab-pane containing all contents of tab
 * @param {any} newParameters - object containing any updated parameter keys
 * @param {boolean} [toPageState = false] whether to copy the parameter values to their ui elements
 */
function setTabParameters($tab, newParameters, toPageState) {

	// make a copy of the new parameters without groupBy and viewGroup if the parameters were meant for
	// a tab with a different operation
	if (newParameters.operation != null && newParameters.operation !== $tab.data('parameters').operation) {
		newParameters = $.extend({}, newParameters);
		// undefined so we don't overwrite our existing parameters
		newParameters.groupBy = undefined;
		newParameters.viewGroup = undefined;
	}

	// write new values while preserving original values
	const updatedParameters = $.extend($tab.data('parameters'), newParameters, $tab.data('constParameters'));

	// copy parameter values to their selectors etc
	if (toPageState) {
		$tab.find('select.groupselect').selectpicker('val', updatedParameters.groupBy);
		$tab.find('.casesensitive').prop('checked', updatedParameters.caseSensitive);
	}
}

/**
 * Updates the internal parameters for a tab and executes a search if the tab is currently active.
 *
 * Any currently shown results are not cleared.
 * Automatically unhides results containers and controls once search completes.
 *
 * @param {any} event where the data attribute holds all new parameters
 */
function onLocalParameterChange(event, parameters) {
	const $tab = $(this);

	setTabParameters($tab, parameters, true);
	$tab.removeData('results'); // Invalidate data to indicate a refresh is required

	if ($tab.hasClass('active')) { // Emulate a reopen of the tab to refresh it
		$tab.trigger('tabOpen');
	}
}

/**
 * The core search trigger, named a little awkwardly because it autotriggers when a tab is made active/opens.
 * We emulate the tab reopening to update the displayed search results when new search parameters are set/selected.
 */
function onTabOpen(/*event, data*/) {

	const $tab = $(this);
	const searchSettings = $.extend({}, $tab.data('defaultParameters'), $tab.data('parameters'), $tab.data('constParameters'));

	// CORE does as little UI manipulation as possible, just shows a tab when required
	// so we're responsible for showing the entire results area.
	$('#results').show();
	const querySummary = getQuerySummary(searchSettings.pattern, searchSettings.within, searchSettings.filters);
	$('#searchFormDivHeader').show()
		.find('#querySummary').text(querySummary).attr('title', querySummary.substr(0, 1000));

	if ($tab.data('results')) {
		// Nothing to do, tab is already displaying data (this happens when you go back and forth between tabs without changing your query in between)
		// Still notify core so that when the url is copied out the current tab can be restored.
		onSearchUpdated(searchSettings);
		return;
	}

	// Not all configurations of search parameters will result in a valid search
	// Verify that we're not trying to view hits without a pattern to generate said hits
	// and warn the user if we are
	if (searchSettings.operation === 'hits' && (searchSettings.pattern == null || searchSettings.pattern.length === 0)) {
		replaceTableContent($tab.find('.resultcontainer table'),
			['<thead>',
				'<tr><th><a>No hits to display</a></th></tr>',
			'</thead>',
			'<tbody>',
				'<tr>',
					'<td class="no-results-found">No hits to display... (one or more of Lemma/PoS/Word is required).</td>',
				'</tr>',
			'</tbody>'
			].join('')
		);
		$tab.find('.resultcontainer').show();
		$tab.find('.resultcontrols').hide();
		$tab.data('results', {}); // Prevent refreshing search on next tab open
		return;
	}

	// All is well, search!
	showSearchIndicator($tab);
	onSearchUpdated(searchSettings);
	search(searchSettings,
		function onSuccess() {
			hideBlsError();
			$tab.data('fnSetResults').apply(undefined, Array.prototype.slice.call(arguments)); // call with original args
		},
		function onError() {
			hideSearchIndicator($tab);
			showBlsError.apply(undefined, Array.prototype.slice.call(arguments)); // call with original args
		}
	);
}

$(document).ready(function() {
	// Hide the results area and deactivate all tabs to prevent accidental refreshes later.
	// Tabs are unhidden when a search is submitted.
	$('#results').hide();
	$('#resultTabs a').each(function() { $(this).tab('hide'); });
	$('.searchIndicator').hide();

	// See parameters type documentation in singlepage-bls.js
	$('#tabHits')
		.data('parameters', {})
		.data('defaultParameters', {
			page: 0,
			pageSize: 50,
			sampleMode: null,
			sampleSize: null,
			sampleSeed: null,
			wordsAroundHit: null,
			pattern: null,
			within: null,
			filters: null,
			sort: null,
			groupBy: null,
			viewGroup: null,
			caseSensitive: null,
		})
		.data('constParameters', {
			operation: 'hits',
		})
		.data('fnSetResults', setTabResults.bind($('#tabHits')[0]));

	$('#tabDocs')
		.data('parameters', {})
		.data('defaultParameters', {
			page: 0,
			pageSize: 50,
			sampleMode: null,
			sampleSize: null,
			sampleSeed: null,
			wordsAroundHit: null,
			pattern: null,
			within: null,
			filters: null,
			sort: null,
			groupBy: null,
			viewGroup: null,
			caseSensitive: null,
		})
		.data('constParameters', {
			operation: 'docs',
		})
		.data('fnSetResults', setTabResults.bind($('#tabDocs')[0]));

	$('#resultTabsContent .tab-pane').on('localParameterChange', onLocalParameterChange);
	$('#resultTabsContent .tab-pane').on('tabOpen', onTabOpen);
	$('#resultTabsContent .tab-pane').on('click', '.exportcsv', onExportCsv);

	// Forward show/open event to tab content pane
	$('#resultTabs a').on('show.bs.tab', function() {
		$($(this).attr('href')).trigger('tabOpen');
	});

	// use indirect event capture for easy access to the tab content-pane
	$('#resultTabsContent .tab-pane')
		.on('click', '[data-bls-sort]', function(event) {
			const sort = $(this).data('blsSort');
			const invert = ($(event.delegateTarget).data('parameters').sort === sort);

			$(this).trigger('localParameterChange', {
				sort: invert ? '-' + sort : sort
			});
			event.preventDefault();
		})
		.on('click', '[data-page]', function(event) {
			$(this).trigger('localParameterChange', {
				page: $(this).data('page')
			});
			event.preventDefault();
		})
		.on('change', '.casesensitive', function(event) {
			$(this).trigger('localParameterChange', {
				caseSensitive: $(this).is(':checked') || null
			});
			event.preventDefault();
		})
		// don't attach to 'changed', as that fires every time a single option is toggled, instead wait for the menu to close
		.on('hide.bs.select', 'select.groupselect', function(event) {
			const prev = $(event.delegateTarget).data('parameters').groupBy || [];
			const cur = $(this).selectpicker('val') || [];
			// Don't fire search if options didn't change

			if (prev.length != cur.length || !prev.every(function(elem) { return cur.includes(elem); })) {
				$(this).trigger('localParameterChange', {
					groupBy: cur,
					page: 0,
					viewGroup: null, // Clear any group we may be currently viewing, as the available groups just changed
					sort:null,
				});
			}

			event.preventDefault();
		})
		.on('click', '.clearviewgroup', function(event) {
			$(this).trigger('localParameterChange', {
				page: 0,
				viewGroup: null,
				sort:null,
			});
			event.preventDefault();
		});
});

/**
 * Request and display more preview text from a document.
 *
 * @param {any} concRow the <tr> element for the current hit. The result will be displayed in the row following this row.
 * @param {any} docPid id/pid of the document
 * @param {number} start
 * @param {number} end
 * @param {('ltr' | 'rtl')} textDirection - to determine whether to specify text direction on the preview text
 */
export function showCitation(concRow, docPid, start, end, textDirection) {
	// Open/close the collapsible in the next row
	const $element = $(concRow).next().find('.collapse');
	$element.collapse('toggle');

	$.ajax({
		url: BLS_URL + 'docs/' + docPid + '/snippet',
		dataType: 'json',
		data: {
			hitstart: start,
			hitend: end,
			wordsaroundhit: 50
		},
		success (response) {
			const parts = snippetParts(response);
			$element.html('<span dir="'+ textDirection+'"><b>Kwic: </b>'+ parts[0] + '<b>' + parts[1] + '</b>' + parts[2]+ '</span>');
		},
		error (jqXHR, textStatus/*, errorThrown*/) {
			$element.text('Error retrieving data: ' + (jqXHR.responseJSON && jqXHR.responseJSON.error) || textStatus);
		}
	});
}

/**
 * Request and display properties of the matched word.
 *
 * @param {any} propRow the <tr> element for the current hit. The result will be displayed in the second row following this row.
 * @param {any} props the properties to show
 */
export function showProperties(propRow, props) {
	// Open/close the collapsible in the next row
	const $element = $(propRow).next().next().find('.collapse');
	$element.collapse('toggle');

	const $p = $('<div/>').text(props).html();
	$element.html('<span><b>Properties: </b>' + $p + '</span>');
}

/**
 * Set new search parameters and mark tabs for a refresh of data.
 *
 * The currently shown tab will auto-refresh.
 * Parameters with corresponding UI-elements within the tabs will update those elements with the new data.
 * NOTE: pagination is never updated based on parameters, but instead drawn based on search response.
 * @param {any} searchParameters New search parameters.
 * @param {boolean} [clearResults=false] Clear any currently displayed search results.
 */
export function setParameters(searchParameters, clearResults = false) {
	$('#resultTabsContent .tab-pane').each(function() {
		const $tab = $(this);
		if (clearResults) {
			clearTabResults($tab);
		}

		$tab.trigger('localParameterChange', searchParameters);
	});
}

/**
 * Clear all results, hide the result area and reset all search parameters within the tabs.
 *
 * Deactivates all tabs and hides the result area.
 */
export function reset() {
	// Hide the results area and deactivate all tabs to prevent accidental refreshes later (search is executed when tab is opened (if search parameters are valid))
	$('#results').hide();
	$('#resultTabs a').each(function() { $(this).tab('hide'); });

	$('#searchFormDivHeader').hide();

	$('#resultTabsContent .tab-pane').each(function() {
		const $tab = $(this);

		clearTabResults($tab);
		$tab.trigger('localParameterChange', $.extend({},
			$tab.data('defaultParameters'),
			$tab.data('constParameters')
		));
	});
}
