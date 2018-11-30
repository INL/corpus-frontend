import $ from 'jquery';

import {store, actions, RootState, UrlPageState} from '@/store';
import * as FormStore from '@/store/form';

import { debugLog } from '@/utils/debug';
import { QueryBuilder } from '@/modules/cql_querybuilder';

export default () => {
	debugLog('Begin connecting listeners to store');

	{
		let lastPattern: FormStore.ModuleRootState['pattern']['advanced'] = null;
		const $querybuilder = $('#querybuilder');
		const instance: QueryBuilder = $querybuilder.data('builder');

		store.watch(state => state.form.pattern.advanced, v => {
			if (v !== lastPattern) {
				lastPattern = v;
				instance.parse(v);
			}
		}, {immediate: true});
		$querybuilder.on('cql:modified', () => {
			const pattern = $querybuilder.data('builder').getCql();
			lastPattern = pattern;
			FormStore.actions.pattern.advanced(pattern);
		});
	}

	{
		const tabs = {
			simple: $('#searchTabs a[href="#simple"]'),
			extended: $('#searchTabs a[href="#extended"]'),
			advanced: $('#searchTabs a[href="#advanced"]'),
			expert: $('#searchTabs a[href="#expert"]'),
		};

		store.watch(state => state.form.activePattern, v => tabs[v].tab('show'), {immediate: true});
		Object.entries(tabs).forEach(([name, $tab]) => $tab.on('show.bs.tab', () => FormStore.actions.activePattern(name as keyof typeof tabs)));
	}

	window.addEventListener('popstate', function(event) {
		const newState: RootState|undefined = event.state;

		if (newState == null) { // No state attached to this history entry - generate from url
			actions.replace(new UrlPageState().get());
		} else { // Just set the state as it was in the history
			actions.replace(event.state);
		}
	});

	debugLog('connected state to page');
};
