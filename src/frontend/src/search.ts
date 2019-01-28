import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';
import Vue from 'vue';

// @ts-ignore
import VTooltip from 'v-tooltip';

import {QueryBuilder, QueryBuilderOptionsDef} from '@/modules/cql_querybuilder';
import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus'; // NOTE: only use after initializing root store
import * as TagsetStore from '@/store/search/tagset';
import * as PatternStore from '@/store/search/form/patterns';
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
function initQueryBuilder(tagset?: TagsetStore.ModuleRootState) {
	debugLog('Begin initializing querybuilder');

	// Initialize configuration
	const instance = new QueryBuilder($('#querybuilder'), {
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: CorpusStore.get.annotations()
					.map((annotation): QueryBuilderOptionsDef['attribute']['view']['attributes'][number] => {
						let values;
						if (tagset) {
							if (annotation.uiType === 'pos') {
								values = Object.values(tagset.values).map(v => ({label: v.displayName, value: v.value}));
							} else if (tagset.subAnnotations[annotation.id]) {
								values = tagset.subAnnotations[annotation.id].values.map(v => ({label: v.displayName, value: v.value}));
							}
						} else {
							values = annotation.values;
						}

						return {
							attribute: annotation.id,
							label: annotation.displayName,
							caseSensitive: annotation.caseSensitive,
							values,
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
Vue.use(VTooltip);
Vue.config.productionTip = false;
$(document).ready(() => {
	RootStore.init();

	// We can render before the tagset loads, the form just won't be populated from the url yet.
	const vueRoot = new Vue({
		store: RootStore.store,
		render: h => h(SearchPageComponent),
		mounted() {
			connectJqueryToPage();

			TagsetStore.actions.awaitInit()
			.then(() => new UrlStateParser().get())
			.then(urlState => {
				debugLog('Loading state from url', urlState);
				RootStore.actions.reset();
				RootStore.actions.replace(urlState);
				debugLog('Finished initializing state shape and loading initial state from url.');

				// Don't do this before the url is parsed, as it controls the page url (among other things derived from the state).
				connectStreamsToVuex();
				// And this needs the tagset to have been loaded (if available)
				initQueryBuilder(TagsetStore.get.isLoaded() ? TagsetStore.getState() : undefined);
			});
		}
	}).$mount(document.querySelector('#vue-root')!);

	(window as any).vueRoot = vueRoot;
});

// Expose and declare some globals
const _Vue = (window as any).Vue = Vue;

declare global {
	// tslint:disable-next-line
	const Vue: typeof _Vue;
	const vueRoot: InstanceType<typeof SearchPageComponent>&{store: typeof RootStore.store};
}
