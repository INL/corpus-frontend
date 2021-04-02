import 'bootstrap';
import 'bootstrap-select';
import 'bootstrap-select/dist/css/bootstrap-select.css';

import $ from 'jquery';
import Vue from 'vue';

// @ts-ignore
import VTooltip from 'v-tooltip';

import Filters from '@/components/filters';

import {QueryBuilder, AttributeDef as QueryBuilderAttributeDef, QueryBuilderOptionsDef} from '@/modules/cql_querybuilder';
import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as TagsetStore from '@/store/search/tagset';
import * as PatternStore from '@/store/search/form/patterns';
import * as FilterStore from '@/store/search/form/filters';
import UrlStateParser from '@/store/search/util/url-state-parser';

import connectStreamsToVuex from '@/store/search/streams';

import SearchPageComponent from '@/pages/search/SearchPage.vue';
import DebugComponent from '@/components/Debug.vue';

import debug, {debugLog} from '@/utils/debug';

import '@/global.scss';
import { multimapReduce, getAnnotationSubset } from '@/utils';
import annotationDistributions from './pages/article/annotationDistributions';
import { Option } from './types/apptypes';

const connectJqueryToPage = () => {
	$('input[data-persistent][id != ""], input[data-persistent][data-pid != ""]').each(function(i, elem) {
		const $this = $(elem);
		const key = 'input_' + ($this.attr('data-pid') || $this.attr('id'));
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


	const first = getAnnotationSubset(
		UIStore.getState().search.advanced.searchAnnotationIds,
		CorpusStore.get.annotationGroups(),
		CorpusStore.get.allAnnotationsMap(),
		'Search',
		CorpusStore.get.textDirection(),
		debug.debug
	);

	const annotationGroups = first.map(g => ({
		groupname: g.label!,
		options: g.entries.map<QueryBuilderAttributeDef>((annot, i) => ({
			attribute: annot.id,
			caseSensitive: annot.caseSensitive,
			label: (g.options[i] as Option).label!,
			textDirection: CorpusStore.get.textDirection(),
			values: annot.values
		}))
	}));

	const withinOptions = UIStore.getState().search.extended.within.elements;
	// Initialize configuration
	const instance = new QueryBuilder($('#querybuilder'), {
		queryBuilder: {
			view: {
				withinSelectOptions: withinOptions
			}
		},
		attribute: {
			view: {
				// Pass the available properties of tokens in this corpus (PoS, Lemma, Word, etc..) to the querybuilder
				attributes: annotationGroups.length > 1 ? annotationGroups : annotationGroups.flatMap(g => g.options),
				defaultAttribute: UIStore.getState().search.advanced.defaultSearchAnnotationId
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
		lastPattern = PatternStore.getState().advanced;
		if (!instance.parse(lastPattern)) {
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
	if (err.message !== '[vuex] Do not mutate vuex store state outside mutation handlers.') { // already logged and annoying
		ga('send', 'exception', { exDescription: err.message, exFatal: true });
		console.error(err);
	} else {
		console.warn(err);
	}
};
Vue.mixin({
	// tslint:disable
	renderError(h, err) {
		// Retrieve component stack
		let components = [this] as Vue[];
		while(components[components.length-1].$options.parent) {
			components.push(components[components.length-1].$options.parent as Vue)
		}
		return (
			<div class="well">
				<h3>Error in component! ({components.map(c => (c.$options as any)._componentTag).reverse().filter(v => !!v).join(' // ')})</h3>
				<pre style="color: red;">
					{err.stack}
				</pre>
			</div>
		)
	}
	// tslint:enable
});

Vue.use(Filters);
Vue.use(VTooltip, {
	popover: {
		defaultBaseClass: 'popover',
		defaultWrapperClass: 'wrapper',
		defaultInnerClass: 'popover-content',
		defaultArrowClass: 'arrow tooltip-arrow',
	}
});
Vue.component('Debug', DebugComponent);


// Expose and declare some globals
(window as any).Vue = Vue;

type Hook = () => void|Promise<any>;
const isHook = (hook: any): hook is Hook => typeof hook === 'function';
declare const hooks: {
	beforeStoreInit?: Hook;
	beforeRender?: Hook;
	beforeStateLoaded?: Hook;
};

async function runHook(hookName: keyof (typeof hooks)) {
	const hook = hooks[hookName];
	if (isHook(hook)) {
		debugLog(`Running hook ${hookName}...`);
		await hook();
		debugLog(`Finished running hook ${hookName}`);
	}
}

$(document).ready(async () => {
	await runHook('beforeStoreInit');

	debugLog('Initializing vuex store...');
	RootStore.init();
	debugLog('Finished initializing vuex store');

	await runHook('beforeRender');

	// We can render before the tagset loads, the form just won't be populated from the url yet.
	(window as any).vueRoot = new Vue({
		store: RootStore.store,
		render: h => h(SearchPageComponent),
		mounted() {
			requestAnimationFrame(() => {
				connectJqueryToPage();

				runHook('beforeStateLoaded')
				.then(() => TagsetStore.actions.awaitInit())
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
			});
		}
	}).$mount(document.querySelector('#vue-root')!);
});
