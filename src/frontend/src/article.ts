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

import URI from 'urijs';

import * as RootStore from '@/store/article';
import ArticlePageComponent from '@/pages/article/ArticlePage.vue';
import ArticlePagePaginationComponent from '@/pages/article/ArticlePagePagination.vue';
import debug from '@/utils/debug';
import initTooltips from '@/modules/expandable-tooltips';

import '@/global.scss';
import '@/article.scss';
import { blacklab } from './api';

// Article-related functions.
// Takes care of tooltips and highlighting/scrolling to anchors.

declare const BLS_URL: string;
declare const INDEX_ID: string;
declare const DOCUMENT_ID: string;

// ---------------------------
// Vue initialization & config
// ---------------------------

HighchartsExporting(Highcharts);
HighchartsExportingData(Highcharts);
HighchartsBoost(Highcharts);

Vue.use(HighchartsVue);

$(document).ready(() => {
	RootStore.init();

	new ArticlePageComponent().$mount(document.getElementById('vue-root-statistics')!);
	new ArticlePagePaginationComponent().$mount(document.getElementById('vue-root-pagination')!);

	(window as any).Vue = Vue;

	// This is pretty horrendous
	// We need a callback when some Vue.observable changes
	// The easy way is through a store watcher, since that works even when the variable is outside the store
	// and even when the store is completely ignored other than that.
	// And since debug.debug is observable, this works!
	RootStore.store.watch(() => debug.debug, (isDebugEnabled) => {
		if (isDebugEnabled) {
			let {wordstart, wordend} = new URI().search(true);
			wordstart = wordstart ? `wordstart=${wordstart}` : '';
			wordend = wordend ? `wordend=${wordend}` : '';

			let q = [wordstart, wordend].filter(v => !!v).join('&');
			q = q ? '?' + q : q;

			blacklab.getDocumentInfo(INDEX_ID, DOCUMENT_ID).then(r => {
				const s =
				`<div id="debug-info">
					<hr>
					<h2>Debug info</h2>

					<table class="table table-striped" style="table-layout: fixed">
						<tr>
							<th>Field</th>
							<th>Values</th>
						</tr>
						${Object.entries(r.docInfo).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
					</table>

					<a href="${BLS_URL}${INDEX_ID}/docs/${DOCUMENT_ID}/contents${q}" target="_blank">Open raw document</a>
				</div>`
				$('#content').append(s)
			})
		} else {
			$('#debug-info').remove();
		}
	}, { immediate: true})

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
