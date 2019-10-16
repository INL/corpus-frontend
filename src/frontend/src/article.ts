import 'bootstrap';
import $ from 'jquery';
import Vue from 'vue';
// @ts-ignore
import * as Highcharts from 'highcharts';
// @ts-ignore
import HighchartsVue from 'highcharts-vue';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsExportingData from 'highcharts/modules/export-data';
import HighchartsBoost from 'highcharts/modules/boost';

import * as RootStore from '@/store/article';
import ArticlePageComponent from '@/pages/article/ArticlePage.vue';
import debug from '@/utils/debug';
import initTooltips from '@/modules/expandable-tooltips';

import '@/global.scss';
import '@/article.scss';

// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

declare const BLS_URL: string;
declare const INDEX_ID: string;
declare const DOCUMENT_ID: string;

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

// ---------------------------
// Vue initialization & config
// ---------------------------

HighchartsExporting(Highcharts);
HighchartsExportingData(Highcharts);
HighchartsBoost(Highcharts);

Vue.use(HighchartsVue);

$(document).ready(() => {
	RootStore.init();

	(window as any).vueRoot = new Vue({
		render: v => v(ArticlePageComponent)
	})
	.$mount(document.querySelector('#vue-root-statistics')!);

	(window as any).Vue = Vue;

	if (debug) {
		$('#content').append(`<hr><a href="${BLS_URL}${INDEX_ID}/docs/${DOCUMENT_ID}/contents?wordend=100" target="_blank">Open raw document</a>`);
	}

	initTooltips({
		mode: 'attributes',
		contentAttribute: 'data-tooltip-content',
		previewAttribute: 'data-tooltip-preview'
	});

	initTooltips({
		mode: 'title',
		excludeAttributes: ['toggle', 'tooltip-content', 'tooltip-preview'],
		tooltippableSelector: '.word[data-toggle="tooltip"]'
	});
});
