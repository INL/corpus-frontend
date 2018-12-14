import $ from 'jquery';

import {store, actions, RootState, UrlPageState} from '@/store';
import * as PatternStore from '@/store/form/patterns';

import { debugLog } from '@/utils/debug';
import { QueryBuilder } from '@/modules/cql_querybuilder';

export default () => {
	debugLog('Begin connecting listeners to store');

	{
		let lastPattern: PatternStore.ModuleRootState['advanced'] = null;
		const $querybuilder = $('#querybuilder');
		const instance: QueryBuilder = $querybuilder.data('builder');

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

		store.watch(state => state.patterns.advanced, v => {
			if (v !== lastPattern) {
				lastPattern = v;
				instance.parse(v);
			}
		});
		$querybuilder.on('cql:modified', () => {
			const pattern = instance.getCql();
			lastPattern = pattern;
			PatternStore.actions.advanced(pattern);
		});
	}

	window.addEventListener('popstate', function(event) {
		// TODO type properly
		const newState: RootState|undefined = event.state;

		if (newState == null) { // No state attached to this history entry - generate from url
			actions.replace(new UrlPageState().get());
		} else { // Just set the state as it was in the history
			actions.replace(event.state);
		}
	});

	debugLog('connected state to page');
};
