import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';
import Vue from 'vue';

// @ts-ignore
import VTooltip from 'v-tooltip';

import Filters from '@/components/filters';

import {QueryBuilder, QueryBuilderOptionsDef} from '@/modules/cql_querybuilder';
import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus'; // NOTE: only use after initializing root store
import * as TagsetStore from '@/store/search/tagset';
import * as PatternStore from '@/store/search/form/patterns';
import * as FilterStore from '@/store/search/form/filters';
import UrlStateParser from '@/store/search/util/url-state-parser';

import connectStreamsToVuex from '@/store/search/streams';

import SearchPageComponent from '@/pages/search/SearchPage.vue';

import {debugLog} from '@/utils/debug';

import '@/global.scss';

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
	const instance = new QueryBuilder($('#querybuilder'), {
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: CorpusStore.get.annotations()
					.map((annotation): QueryBuilderOptionsDef['attribute']['view']['attributes'][number] => {
						return {
							attribute: annotation.id,
							label: annotation.displayName,
							caseSensitive: annotation.caseSensitive,
							textDirection: annotation.isMainAnnotation ? CorpusStore.get.textDirection() : undefined,
							values: annotation.values,
						};
					})
				,

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
Vue.config.productionTip = false;
Vue.config.errorHandler = (err, vm, info) => {
	ga('send', 'exception', { exDescription: err.message, exFatal: true });
};

Vue.use(Filters);
Vue.use(VTooltip, {
	popover: {
		defaultBaseClass: 'popover',
		defaultWrapperClass: 'wrapper',
		defaultInnerClass: 'popover-content',
		defaultArrowClass: 'arrow tooltip-arrow',
	}
});

$(document).ready(() => {
	RootStore.init();

	// We can render before the tagset loads, the form just won't be populated from the url yet.
	(window as any).vueRoot = new Vue({
		store: RootStore.store,
		render: h => h(SearchPageComponent),
		mounted() {
			connectJqueryToPage();

			TagsetStore.actions.awaitInit()
			.then(() => new UrlStateParser(FilterStore.getState().filters).get())
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

// Expose and declare some globals
(window as any).Vue = Vue;
