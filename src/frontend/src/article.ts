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
//@ts-ignore
import VuePlausible from 'vue-plausible/lib/esm/vue-plugin.js';

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


// ---------------------------
// Vue initialization & config
// ---------------------------

HighchartsExporting(Highcharts);
HighchartsExportingData(Highcharts);
HighchartsBoost(Highcharts);

if (PLAUSIBLE_DOMAIN && PLAUSIBLE_APIHOST) {
	Vue.use(VuePlausible, {
		domain: PLAUSIBLE_DOMAIN,
		trackLocalhost: true,
		apiHost: PLAUSIBLE_APIHOST,
	});
	//@ts-ignore
	Vue.$plausible.trackPageview();
}Vue.use(HighchartsVue);

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
			let wordstart = PAGE_START;
			let wordend = PAGE_END;

			let q = Object.entries({wordstart, wordend}).filter(([k, v]) => !!v).reduce((acc, [k, v]) => acc += `&${k}=${v}`, '');
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
						${Object.entries(r.docInfo).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
					</table>

					<a href="${BLS_URL}${INDEX_ID}/docs/${DOCUMENT_ID}/contents${q}" target="_blank">Open raw document</a>
				</div>`

				$('#articleTabs').append(`<li id="debug-tab"><a href="#debug" data-toggle="tab">Debug</a></li>`)
				$('.tab-content').append(`<div id="debug" class="tab-pane">${s}</div>`)
			})
		} else {
			$('#debug').remove();
			$('#debug-tab').remove();
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
