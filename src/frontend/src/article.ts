import 'bootstrap';
import $ from 'jquery';

import '@/global.scss';
import '@/article.scss';

// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

let $hits: JQuery<HTMLElement>;
let currentHit: number;

function gotoHit(position: number) {
	if ($hits.length === 0) {
		return;
	}

	$($hits[currentHit]).removeClass('active');
	window.location.hash = '';

	// invalid index -> no hit made active
	if (position != null && position >= 0 && position < $hits.length) {
		const $hit = $($hits[position]);

		$hit.addClass('active').attr('id', '#' + position);
		window.location.hash = position.toString();

		$('html, body').animate({
			scrollTop: $hit.offset()!.top - $(window).height()!/2,
			scrollLeft: $hit.offset()!.left - $(window).width()!/2
		}, 0);
	}

	currentHit = position;
}

// Highlight and scroll to previous anchor
function gotoPrevious() {
	if(currentHit-1 < 0) {
		gotoHit($hits.length-1);
	} else {
		gotoHit(currentHit-1);
	}

	return false;
}

// Highlight and scroll to next anchor
function gotoNext() {
	gotoHit((currentHit + 1) % $hits.length);
	return false; // don't follow link
}

$(document).ready(function() {
	$hits = $('.hl');
	currentHit = 0;

	// Create jQuery Tooltips from title attributes
	$('span.word').tooltip();

	// Show number of hits at the top of the metadata
	$('#divHitsInDocument').text($hits.length);

	if($hits.length > 0) {
		$('#next').on('click', e => {
			e.preventDefault();
			gotoNext();
		});
		$('#prev').on('click', e => {
			e.preventDefault();
			gotoPrevious();
		});
		$('.hitscroll').show();
	}

	if (location.hash != null && location.hash !== '') {
		gotoHit(parseInt(location.hash.substring(1), 10)); // skip leading #
	} else {
		gotoHit(0);
	}
});
