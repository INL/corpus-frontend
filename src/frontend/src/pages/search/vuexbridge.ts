import $ from 'jquery';

import {store, actions, RootState, UrlPageState} from '@/store';
import * as FormStore from '@/store/form';

import { debugLog } from '@/utils/debug';
import { QueryBuilder } from '@/modules/cql_querybuilder';

export default () => {
	debugLog('Begin connecting listeners to store');

	{
		let lastPattern: string;
		const $querybuilder = $('#querybuilder');
		const instance: QueryBuilder = $querybuilder.data('builder');

		store.watch(state => state.form.pattern.queryBuilder, v => {
			if (v !== lastPattern) {
				lastPattern = v || '';
				instance.parse(v || '');
			}
		}, {immediate: true});
		$querybuilder.on('cql:modified', () => {
			const pattern = $querybuilder.data('builder').getCql();
			lastPattern = pattern;
			FormStore.actions.pattern.queryBuilder(pattern);
		});
	}

	{
		const $simple = $('#searchTabs a[href="#simple"]');
		const $querybuilder = $('#searchTabs a[href="#advanced"]');
		const $cql = $('#searchTabs a[href="#query"]');

		store.watch(state => state.form.activePattern, v => {
			switch (v) {
				case 'simple': $simple.tab('show'); return;
				case 'queryBuilder': $querybuilder.tab('show'); return;
				case 'cql': $cql.tab('show'); return;
			}
		});

		$simple.on('show.bs.tab', () => FormStore.actions.activePattern('simple'));
		$querybuilder.on('show.bs.tab', () => FormStore.actions.activePattern('queryBuilder'));
		$cql.on('show.bs.tab', () => FormStore.actions.activePattern('cql'));
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
