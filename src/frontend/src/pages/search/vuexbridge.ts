import $ from 'jquery';
import URI from 'urijs';

import {store, getState, actions, RootState, UrlPageState} from '@/store';
import * as ResultsStore from '@/store/results';
import * as SettingsStore from '@/store/settings';
import * as FormStore from '@/store/form';

import { debugLog } from '@/utils/debug';
import { QueryBuilder } from '@/modules/cql_querybuilder';

/*
	This is some ugly-ish code that implements some one- and two-way binding between oldschool normal html elements and the vuex store.
	Once we have all state properly updating in the store and vice versa, migrating components into vue one by one should become easy.

	The idea is to first get some basic synchronization of the jquery and vuex store working.
*/

/** Set the new value and trigger a change event, but only when the value is different */
function changeText($input: JQuery<HTMLInputElement>, value: string|null|number) {
	if (value == null) {
		value = '';
	} else if (typeof value !== 'string') {
		value = '' + value;
	}
	if ($input.val() as string !== value) {
		$input.val(value).change();
	}
}
/** Set the new value and trigger a change event, but only when the value is different */
function changeSelect($input: JQuery<HTMLSelectElement>, value: string|string[]|null) {
	function eq(a: any, b: any) {
		if (a instanceof Array && b instanceof Array) {
			if (a.length!==b.length) { // assert same length
				return false;
			}
			for(let i = 0; i < a.length; ++i) { // assert each element equal
				if (!eq(a[i], b[i])) {
					return false;
				}
			}
			return true;
		} else {
			return a===b;  // if not both arrays, should be the same
		}
	}

	const valBefore = $input.selectpicker('val');
	$input.selectpicker('val', value as any);
	const valAfter = $input.selectpicker('val');

	if (!eq(valBefore, valAfter)) {
		$input.change();
	}
}
function changeCheck($input: JQuery<HTMLInputElement>, value: boolean) {
	if ($input.is(':checked') === value) {
		return;
	} else {
		$input.prop('checked', value).change();
	}
}

// TODO move verification of options into store
export default () => {
	debugLog('Begin connecting listeners to store');
	{
		const $pageSize = $('#resultsPerPage') as JQuery<HTMLSelectElement>;
		store.watch(state => state.settings.pageSize, v => changeSelect($pageSize, v+''), {immediate: true});
		$pageSize.on('change', () => {
			const v = Number.parseInt($pageSize.selectpicker('val') as string, 10);
			if (v !== SettingsStore.getState().pageSize) {
				SettingsStore.actions.pageSize(v);
			}
		});
	}

	{
		// TODO enum
		const $sampleMode = $('#sampleMode') as JQuery<HTMLSelectElement>;
		store.watch(state => state.settings.sampleMode, v => changeSelect($sampleMode, v), {immediate: true});
		$sampleMode.on('change', () => {
			const v = $sampleMode.selectpicker('val') as string;
			if (v !== SettingsStore.getState().sampleMode) {
				SettingsStore.actions.sampleMode(v as any);
			}
		});
	}

	{
		const $sampleSize = $('#sampleSize') as JQuery<HTMLInputElement>;
		store.watch(state => state.settings.sampleSize,v => changeText($sampleSize, v+''), {immediate: true});
		$sampleSize.on('change', () => {
			let n: number|null = Number.parseInt($sampleSize.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== SettingsStore.getState().sampleSize) {
				SettingsStore.actions.sampleSize(n);
				ResultsStore.actions.resetPage();
			}
		});
	}

	{
		const $sampleSeed = $('#sampleSeed') as JQuery<HTMLInputElement>;
		store.watch(state => state.settings.sampleSeed, v => changeText($sampleSeed, v), {immediate: true});
		$sampleSeed.on('change', () => {
			let n: number|null = Number.parseInt($sampleSeed.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== SettingsStore.getState().sampleSeed) {
				SettingsStore.actions.sampleSeed(n);
			}
		});
	}

	{
		const $wordsAroundHit = $('#wordsAroundHit')  as JQuery<HTMLInputElement>;
		store.watch(state => state.settings.wordsAroundHit, v => changeText($wordsAroundHit, v), {immediate: true});
		$wordsAroundHit.on('change keyup', e => {
			let n: number|null = Number.parseInt($wordsAroundHit.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== SettingsStore.getState().wordsAroundHit) {
				SettingsStore.actions.wordsAroundHit(n);
			}
		});
	}

	{
		let preventNextUpdate = false; // use some other guarding to prevent repeatedly comparing long strings
		const $querybox = $('#querybox') as JQuery<HTMLTextAreaElement>;
		store.watch(state => state.form.pattern.cql, v => {
			if (!preventNextUpdate) {
				$querybox.val(v as string).change();
			}
			preventNextUpdate = false;
		}, {immediate: true});
		$querybox.on('change keyup', e => {
			preventNextUpdate = true;
			FormStore.actions.pattern.cql($querybox.val() as string);
		});
	}

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
		const $within = $('#simplesearch_within');
		store.watch(state => state.form.pattern.simple.within, v => {
			if (!v) {
				$within.find('input').first().parent().button('toggle');
			} else {
				$within.find(`input[value="${v}"]`).parent().button('toggle');
			}
		}, {immediate: true});
		$within.on('change', () => {
			const value = $within.find('input:checked').val() as string || null;
			FormStore.actions.pattern.simple.within(value);
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

	store.watch(state => state.viewedResults, v => {
		$('#results').toggle(!!v);
	}, {immediate: true});

	// Reset & history navigation
	$('#mainForm').on('reset', () => {
		actions.reset();

		// TODO map PageState to url and autoupdate on appropriate state updates
		const url = new URI();
		const newUrl = url.search('').segmentCoded(url.segmentCoded().filter(s => s !== 'hits' && s !== 'docs'));

		history.pushState(getState(), undefined, newUrl.toString());

		return false;
	});
	$('#mainForm').on('submit', () => {
		ResultsStore.actions.resetPage();
		ResultsStore.actions.resetGroup();
		actions.search();

		// May be used as click handler, so prevent event propagation
		return false;
	});

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
