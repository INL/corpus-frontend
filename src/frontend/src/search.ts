import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';
import Vue from 'vue';

// @ts-ignore
import VTooltip from 'v-tooltip';

import {QueryBuilder, QueryBuilderOptionsDef} from '@/modules/cql_querybuilder';
import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus'; // NOTE: only use after initializing root store
import * as TagsetStore from '@/store/tagset';
import * as PatternStore from '@/store/form/patterns';

import debug, {debugLog} from '@/utils/debug';

import connectStreamsToVuex from '@/store/streams';

import SearchPageComponent from '@/pages/search/SearchPage.vue';

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

	// Enable wide view toggle
	$('#wide-view').on('change', function() {
		$('.container, .container-fluid').toggleClass('container', !$(this).is(':checked')).toggleClass('container-fluid', $(this).is(':checked'));
	});
};

// Init the querybuilder with the supported attributes/properties
function initQueryBuilder() {
	debugLog('Begin initializing querybuilder');

	// Initialize configuration
	const firstPos = CorpusStore.get.annotations().find(a => a.uiType === 'pos');
	const instance = new QueryBuilder($('#querybuilder'), {
		queryBuilder: {
			view: {
				pos: firstPos ? {
					id: firstPos.id,
					displayName: firstPos.displayName
				} : null
			}
		},
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: CorpusStore.get.annotations()
					.filter(a => !a.parentAnnotationId || a.uiType === 'pos') // no subannotations
					.map((annotation): QueryBuilderOptionsDef['attribute']['view']['attributes'][number] => ({
						attribute: annotation.id,
						label: annotation.displayName,
						caseSensitive: annotation.caseSensitive,
						// values: TagsetStore.getState().
					})),

				defaultAttribute: CorpusStore.get.firstMainAnnotation().id
			}
		}
	});

	// Set initial value
	let lastPattern: PatternStore.ModuleRootState['advanced'] = null;
	if (PatternStore.getState().advanced == null) {
		// not initialized in store, set to default from querybuilder
		lastPattern = instance.getCql();
		PatternStore.actions.advanced(lastPattern);
	} else {
		// already something in store - copy to querybuilder.
		if (!instance.parse(PatternStore.getState().advanced)) {
			// Apparently it's invalid? reset to default.
			PatternStore.actions.advanced(instance.getCql());
		}
	}

	// Enable two-way binding.
	RootStore.store.watch(state => state.patterns.advanced, v => {
		if (v !== lastPattern) {
			lastPattern = v;
			instance.parse(v);
		}
	});
	instance.element.on('cql:modified', () => {
		const pattern = instance.getCql();
		lastPattern = pattern;
		PatternStore.actions.advanced(pattern);
	});

	debugLog('Finished initializing querybuilder');
}

// --------------
// Initialize vue
// --------------
Vue.use(VTooltip);
Vue.config.productionTip = false;

$(document).ready(() => {
	RootStore.init();

	// We can render before the tagset loads, the form just won't be populated from the url yet.
	new Vue({
		store: RootStore.store,
		render: h => h(SearchPageComponent),
		mounted() {
			connectJqueryToPage();

			TagsetStore.actions.awaitInit()
			.then(() => new RootStore.UrlPageState().get())
			.then(urlState => {
				debugLog('Loading state from url', urlState);
				RootStore.actions.reset();
				RootStore.actions.replace(urlState);
				debugLog('Finished initializing state shape and loading initial state from url.');

				// Don't do this before the url is parsed, as it controls the page url (among other things derived from the state).
				connectStreamsToVuex();
				// And this needs the tagset to have been loaded (if available)
				initQueryBuilder();
			});
		}
	}).$mount(document.querySelector('#vue-root')!);
});
