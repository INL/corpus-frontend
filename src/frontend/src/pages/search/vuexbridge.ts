import $ from 'jquery';
import URI from 'urijs';

import {store, getState, actions, RootState, UrlPageState} from '@/store';
import * as ResultsStore from '@/store/results';
import * as SettingsStore from '@/store/settings';
import * as FormStore from '@/store/form';

import { cancelSearch } from '@/modules/singlepage-bls';
import { debugLog } from '@/utils/debug';
import { QueryBuilder } from '@/modules/cql_querybuilder';

import { FilterField, FilterType } from '@/types/pagetypes';

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
$(document).ready(() => {
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

	// TODO initialization order is a bit of a mess. querybuilder is constructed after connecting to the page
	// so delay this a little
	setTimeout(() => {
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
	}, 0);

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
		$('.propertyfield').each(function() {
			const $this = $(this);
			const id = $this.attr('id')!;
			const $textOrSelect = $this.find('#' + id + '_value');
			const $fileInput = $this.find('#' + id + '_file') as JQuery<HTMLInputElement>; // NOTE: not always available
			const $caseInput = $this.find('#' + id + '_case') as JQuery<HTMLInputElement>;

			// Store -> UI
			store.watch(state => state.form.pattern.simple.annotationValues[id].case, v => changeCheck($caseInput, v), {immediate: true});
			store.watch(state => state.form.pattern.simple.annotationValues[id].value, v => {
				if ($textOrSelect.is('select')) {
					changeSelect($textOrSelect as JQuery<HTMLSelectElement>, v);
				} else {
					changeText($textOrSelect as JQuery<HTMLInputElement>, v);
				}
			}, {immediate: true});

			// UI -> Store
			$textOrSelect.on('change', () => FormStore.actions.pattern.simple.annotation({
				id,
				value: $textOrSelect.val() as string || ''
			}));

			// UI -> Store
			$fileInput.on('change', function() { // no arrow-func due to context issues
				const file = this.files && this.files[0];
				if (file != null) {
					const fr = new FileReader();
					fr.onload = function() {
						// Replace all whitespace with pipes,
						// this is due to the rather specific way whitespace in the simple search property fields is treated (see singlepage-bls.js:getPatternString)
						// TODO discuss how we treat these fields with Jan/Katrien, see https://github.com/INL/corpus-frontend/issues/18
						FormStore.actions.pattern.simple.annotation({
							id,
							value: (fr.result as string).replace(/\s+/g, '|'),
						});
					};
					fr.readAsText(file);
				} else {
					FormStore.actions.pattern.simple.annotation({
						id,
						value: '', // clear value when the file is cleared
					});
				}
			});

			// UI -> Store
			$caseInput.on('change', function() {
				FormStore.actions.pattern.simple.annotation({
					id,
					case: $caseInput.is(':checked')
				});
			});
		});
	}

	{
		$('.filterfield').each(function() {
			const $this = $(this);
			const id = $this.attr('id')!;
			const type = $this.data('filterfield-type') as FilterField['filterType'];
			const $inputs = $this.find('input, select') as JQuery<HTMLElement>;

			// Store -> UI
			store.watch(state => state.form.filters[id].values, values => {
				if (type === FilterType.range) {
					changeText($($inputs[0]) as JQuery<HTMLInputElement>, values[0]);
					changeText($($inputs[1]) as JQuery<HTMLInputElement>, values[1]);
				} else if (type ===  FilterType.select) {
					changeSelect($inputs.first() as JQuery<HTMLSelectElement>, values);
				} else {
					changeText($inputs.first() as JQuery<HTMLInputElement>, values[0]);
				}
			}, {immediate: true});

			// UI -> store
			$this.on('change', function() {
				let values: string[];

				// Has two input fields, special treatment
				if (type === FilterType.range) {
					values = [
						$($inputs[0]).val() as string,
						$($inputs[1]).val() as string
					];
				} else {
					// We don't know whether the input is actually a (multi-)select, date field, or text input
					// So .val() could be a single string, null/undefined, or an array of strings
					// Concat all values then remove empty/null values
					values = ([] as string[]).concat($inputs.first().val() as string | string[])
						.filter(v => !!v); // Remove null, empty strings
				}
				FormStore.actions.filter({id, values});
			});
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
		cancelSearch();

		// TODO map PageState to url and autoupdate on appropriate state updates
		const url = new URI();
		const newUrl = url.search('').segmentCoded(url.segmentCoded().filter(s => s !== 'hits' && s !== 'docs'));

		history.pushState(getState(), undefined, newUrl.toString());

		return false;
	});
	$('#mainForm').on('submit', () => {
		ResultsStore.actions.resetPage();
		actions.search();

		// TODO this seems to fire before the state is updated - move to vuexbridge
		$('html, body').animate({
			scrollTop: $('.querysummary').offset()!.top - 75 // navbar
		}, 500);

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

	// TODO restore pattern tab

	debugLog('connected state to page');
});

/* TODO
updateFilterDisplay();
*/
