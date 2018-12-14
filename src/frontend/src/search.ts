import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';
import Vue from 'vue';

// @ts-ignore
import VTooltip from 'v-tooltip';

import {QueryBuilder, QueryBuilderOptionsDef} from '@/modules/cql_querybuilder';
import {store, init as initStore, UrlPageState} from '@/store';
import * as CorpusStore from '@/store/corpus'; // NOTE: only use after initializing root store
import {debugLog} from '@/utils/debug';
import {normalizeIndex} from '@/utils/blacklabutils';

import connectVuexToPage from '@/pages/search/vuexbridge';
import connectStreamsToVuex from '@/store/streams';

import SearchPageComponent from '@/pages/search/SearchPage.vue';

import * as AppTypes from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';

import '@/global.scss';

declare const SINGLEPAGE: {INDEX: BLTypes.BLIndexMetadata};

const connectJqueryToPage = () => {
	$('input[data-persistent][id != ""]').each(function(i, elem) {
		const $this = $(elem);
		const key = 'input_' + $this.attr('id');
		$this.on('change', function() {
			const curVal: any = $this.is(':checkbox') ? $this.is(':checked') : $this.val();
			window.localStorage.setItem(key, curVal);
		});

		if (window.localStorage) {
			const storedVal = window.localStorage.getItem(key);
			if (storedVal != null) {
				$this.is(':checkbox') ? $this.attr('checked', (storedVal.toLowerCase() === 'true') as any) : $this.val(storedVal);
			}
		}

		// run handler once, init localstorage if required
		// Only do next tick so handlers have a change to register
		setTimeout(function() { $this.trigger('change'); });
	});

	// Init the querybuilder with the supported attributes/properties
	debugLog('Begin initializing querybuilder');
	const queryBuilder = new QueryBuilder($('#querybuilder'), {
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: CorpusStore.get.annotations()
					.map((annotation): QueryBuilderOptionsDef['attribute']['view']['attributes'][number] => ({
						attribute: annotation.id,
						label: annotation.displayName,
						caseSensitive: annotation.caseSensitive,
					})),

				defaultAttribute: CorpusStore.get.firstMainAnnotation().id
			}
		}
	});

	// Enable wide view toggle
	$('#wide-view').on('change', function() {
		$('.container, .container-fluid').toggleClass('container', !$(this).is(':checked')).toggleClass('container-fluid', $(this).is(':checked'));
	});
};

// --------------
// Initialize vue
// --------------
Vue.use(VTooltip);

$(document).ready(() => {
	const normalizedIndex: AppTypes.NormalizedIndex = normalizeIndex(SINGLEPAGE.INDEX);
	const stateFromUrl = new UrlPageState().get();

	initStore(normalizedIndex, stateFromUrl);
	connectStreamsToVuex();

	Vue.config.productionTip = false;

	new Vue({
		store,
		render: h => h(SearchPageComponent),
		mounted() {
			connectJqueryToPage();
			connectVuexToPage();
		}
	}).$mount(document.querySelector('#vue-root')!);
});
