import 'bootstrap';
import * as $ from 'jquery';

// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

$(document).ready(function() {

	// Create jQuery Tooltips from title attributes
	$('span.word').tooltip();

	// Show number of hits at the top of the metadata
	const numHits = $('.hl').length;
	$('#divHitsInDocument').text(numHits);
});

// For navigating through search hits within the article
// --------------------------------------------------------------------
const ANCHORS: any = {};

(function() {
	let $hits;
	let currentHit = 0; // index into $hits

	$(document).ready(function() {

		$hits = $('.hl');

		if($hits.length > 0) {
			$('.hitscroll').show();
		}

		if (location.hash != null && location.hash !== '') {
			ANCHORS.gotoHit(parseInt(location.hash.substring(1), 10));
		} // skip leading #
		else {
			ANCHORS.gotoHit(0);
		}
	});

	ANCHORS.gotoHit = function(position) {
		if ($hits.length === 0) {
			return;
		}

		$($hits[currentHit]).removeClass('active');
		location.hash = '';

		// invalid index -> no hit made active
		if (position != null && position >= 0 && position < $hits.length) {
			const $hit = $($hits[position]);

			$hit.addClass('active').attr('id', '#' + position);
			location.hash = position;

			$('html, body').animate({
				scrollTop: $hit.offset()!.top - $(window).height()!/2,
				scrollLeft: $hit.offset()!.left - $(window).width()!/2
			}, 0);
		}

		currentHit = position;
	};

	// Highlight and scroll to previous anchor
	ANCHORS.gotoPrevious = function() {

		if(currentHit-1 < 0) {
			ANCHORS.gotoHit($hits.length-1);
		}
		else {
			ANCHORS.gotoHit(currentHit-1);
		}

		return false;
	};

	// Highlight and scroll to next anchor
	ANCHORS.gotoNext = function() {
		ANCHORS.gotoHit((currentHit + 1) % $hits.length);
		return false; // don't follow link
	};

})();
