import 'bootstrap';
import 'bootstrap-select';
import {saveAs} from 'file-saver';
import $ from 'jquery';
import URI from 'urijs';

import {debugLog} from '@/utils/debug';
import {getBlsParamFromState} from '@/modules/singlepage-bls';
import {getState} from '@/store';

import * as BLTypes from '@/types/blacklabtypes';

declare var BLS_URL: string;

/**
 * Fade out the table, then replace its contents, and call a function.
 *
 * @param $table the <table>
 * @param html Table contents including thead and tbody as as string
 * @param onComplete callback, will be called in the context of $table
 */
function replaceTableContent($table: JQuery<HTMLElement>, html: string, onComplete?: ($table: JQuery<HTMLElement>) => void) {
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
 */
const showBlsError: JQuery.Ajax.ErrorCallback<any> = (jqXHR, textStatus, errorThrown) => {
	const errordata = (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) || {
		code: 'WEBSERVICE_ERROR',
		message: 'Error contacting webservice: ' + textStatus + '; ' + errorThrown
	};

	$('#errorDiv').text(errordata.message + ' (' + errordata.code + ') ').show();
};

/**
 * Create pagination buttons based on a set of results.
 *
 * Buttons contain a data-page attribute containing the page index they're displaying - 1.
 *
 * @param $pagination <ul> element where the generated pagination will be placed.
 * @param data a blacklab-server search response containing either groups, docs, or hits.
 */
function updatePagination($pagination: JQuery<HTMLElement>, data: BLTypes.BLSearchResult) {
	let beginIndex = data.summary.windowFirstResult;
	const pageSize = data.summary.requestedWindowSize;
	let totalResults: number;

	if (BLTypes.isGroups(data)) {
		totalResults = data.summary.numberOfGroups;
	} else {
		totalResults = BLTypes.isHitResults(data) ? data.summary.numberOfHitsRetrieved : data.summary.numberOfDocsRetrieved;
	}

	// when out of bounds results, draw at least the last few pages so the user can go back
	if (totalResults < beginIndex) {
		beginIndex = totalResults+1;
	}

	const totalPages =  Math.ceil(totalResults / pageSize);
	const currentPage = Math.ceil(beginIndex / pageSize);
	const startPage = Math.max(currentPage - 10, 0);
	const endPage = Math.min(currentPage + 10, totalPages);

	const html = [] as Array<string|number>;
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

// STATE
/**
 * Request the currently shown results as a CSV file, and save it.
 *
 * 'this' should be the tab containing the results to export.
 * 'event.target' should be the element that was clicked.
 */
function onExportCsv(event: JQueryEventObject) {
	const $button = $(event.target);
	if ($button.hasClass('disabled')) {
		return;
	}

	const blsParam = getBlsParamFromState();
	const operation = getState().viewedResults!; // should always be valid if the button can be clicked

	(blsParam as any).outputformat = 'csv';
	delete blsParam.number;
	delete blsParam.first;

	const url = new URI(BLS_URL).segment(operation).addSearch(blsParam).toString();
	debugLog('CSV download url', url, blsParam); // eslint-disable-line

	$button
		.addClass('disabled')
		.attr('disabled', '')
		.prepend('<span class="fa fa-spinner fa-spin"></span>');
	$.ajax(url, {
		accepts: {json: 'application/json'},
		cache: false,
		data: 'text',
		success (data) {
			// NOTE: Excel <=2010 seems to ignore the BOM altogether, see https://stackoverflow.com/a/19516038
			const b = new Blob([data], { type: 'text/plain;charset=utf-8' });
			saveAs(b, 'data.csv'); // FileSaver.js
		},
		complete () {
			$button
				.removeClass('disabled')
				.removeAttr('disabled')
				.find('.fa-spinner').remove();
		}
	});
}
