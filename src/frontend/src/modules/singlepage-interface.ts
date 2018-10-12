import 'bootstrap';
import 'bootstrap-select';
import $ from 'jquery';

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
