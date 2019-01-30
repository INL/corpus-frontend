import 'bootstrap';
import $ from 'jquery';
import Vue from 'vue';
// @ts-ignore
import * as Highcharts from 'highcharts';
import HighchartsVue from 'highcharts-vue';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsExportingData from 'highcharts/modules/export-data';

import tippy from 'tippy.js';
import Mustache from 'mustache';

import * as RootStore from '@/store/article';
import ArticlePageComponent from '@/pages/article/ArticlePage.vue';

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

	function getAttributeList(element: Element) {
		const ret = [];

		let key: string;
		let value: string;
		for ({name: key, value} of element.attributes) {
			if (key.startsWith('data-') && value && key !== 'data-toggle') {
				ret.push({key: key.substring(5), value});
			}
		}
		return ret;
	}

	// Is this correct? It seems a little strange we don't get some sort of compiled template back.
	const template = `
		<table class="table" style="table-layout:fixed;width:auto;min-width:300px;">
			<tbody>
				{{#props}}
				<tr>
					<td>{{key}}</td>
					<td>{{value}}</td>
				</tr>
				{{/props}}
			</tbody>
		</table>`;
	const writer = new Mustache.Writer();
	writer.parse(template);

	// Create jQuery Tooltips from title attributes
	tippy('.word[data-toggle="tooltip"]', {
		animateFill: false,
		allowHTML: true,
		delay: [60,0],
		duration: [0,0],
		interactive: true,
		performance: true,
		trigger: 'focus mouseenter',
		onMount(instance) {
			const attrs = getAttributeList(instance.reference);
			if (attrs.length === 0 && instance.reference.attributes.getNamedItem('title')) {
				// sub title attribute for a default value if nothing else is present.
				attrs.push({
					key: 'title',
					value: instance.reference.attributes.getNamedItem('title')!.name
				});
			}

			if (attrs.length === 0) {
				return;
			} else if (attrs.length === 1) {
				// Don't bother with a table if there's only one value to display
				instance.setContent(attrs[0].value);
			} else {
				const content = writer.render(template, { props: getAttributeList(instance.reference) }, {});
				instance.setContent(content);
			}
		}
	});

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

Vue.use(HighchartsVue);

$(document).ready(() => {
	RootStore.init();

	(window as any).vueRoot = new Vue({
		render: v => v(ArticlePageComponent)
	})
	.$mount(document.querySelector('#vue-root-statistics')!);

	(window as any).Vue = Vue;
});
