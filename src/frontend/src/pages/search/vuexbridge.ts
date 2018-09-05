import $ from 'jquery';

import {getState, store, actions} from './state';

import {populateQueryBuilder} from '../../search';  // FIXME extract into querybuilder module
import { PropertyField, FilterField, FilterType } from '../../types/pagetypes';

/*
	This is some ugly-ish code that implements some one- and two-way binding between oldschool normal html elements and the vuex store.
	Once we have all state properly updating in the store and vice versa, migrating components into vue one by one should become easy.

	The idea is to first get some basic synchronization of the jquery and vuex store working.
*/

$(document).ready(() => {
	{
		const $pageSize = $('#resultsPerPage');
		store.watch(state => state.pageSize, v => $pageSize.selectpicker('val', '' + v));
		$pageSize.on('change', e => actions.pageSize(Number.parseInt($pageSize.selectpicker('val') as string, 10)));
	}

	{
		const $sampleMode = $('#sampleMode');
		store.watch(state => state.sampleMode, v => $sampleMode.selectpicker('val', v));
		$sampleMode.on('change', e => actions.sampleMode($sampleMode.selectpicker('val') as any));
	}

	{
		const $sampleSize = $('#sampleSize');
		store.watch(state => state.sampleSize, v => $sampleSize.val(v as any));
		$sampleSize.on('change keyup', e => {
			let n: number|null = Number.parseInt($sampleSize.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().sampleSize) {
				actions.sampleSize(n);
			}
		});
	}

	{
		const $sampleSeed = $('#sampleSeed');
		store.watch(state => state.sampleSeed, v => $sampleSeed.val(v as any));
		$sampleSeed.on('change', e => actions.sampleSeed($sampleSeed.val() as any));
	}

	{
		const $wordsAroundHit = $('#wordsAroundHit');
		store.watch(state => state.wordsAroundHit, v => $wordsAroundHit.val(v as any));
		$wordsAroundHit.on('change keyup', e => {
			let n: number|null = Number.parseInt($wordsAroundHit.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().wordsAroundHit) {
				actions.wordsAroundHit(n);
			}
		});
	}

	{
		let preventNextUpdate = false;
		const $querybox = $('#querybox');
		store.watch(state => state.patternString, v => {
			if (!preventNextUpdate) {
				$querybox.val(v as string);
			}
			preventNextUpdate = false;
		});
		$querybox.on('change keyup', e => {
			preventNextUpdate = true;
			actions.patternString($querybox.val() as string);
		});
	}

	{
		let lastPattern: string;
		const $querybuilder = $('#querybuilder');
		store.watch(state => state.patternQuerybuilder, v => {
			if (v !== lastPattern) {
				populateQueryBuilder(v);
			}
		});
		$querybuilder.on('cql:modified', () => {
			const pattern = $querybuilder.data('builder').getCql();
			lastPattern = pattern;
			actions.patternQuerybuilder(pattern);
		});
	}

	{
		const $within = $('#simplesearch_within');
		store.watch(state => state.within, v => {
			$within.find(`input[value="${v}"]`).parent().button('toggle');
		});
		$within.on('change', () => {
			const value = $within.find('input:checked').val() as string || null;
			actions.within(value);
		});
	}

	{
		$('.propertyfield').each(function() {
			const $this = $(this);
			const id = $this.attr('id')!;
			const $textOrSelect = $this.find('#' + id + '_value');
			const $fileInput = $this.find('#' + id + '_file') as JQuery<HTMLInputElement>; // NOTE: not always available
			const $caseInput = $this.find('#' + id + '_case');

			const getCurrentState = () => getState().pattern[id] || {
				name: id,
				value: $textOrSelect.val() as string || '',
				case: $caseInput.is(':checked')
			};

			$textOrSelect.on('change', function() { // no arrow-func due to context issues
				actions.pattern({
					...getCurrentState(),
					value: $textOrSelect.val() as string || '',
				});
			});

			$fileInput.on('change', function() { // no arrow-func due to context issues
				const file = this.files && this.files[0];
				if (file != null) {
					const fr = new FileReader();
					fr.onload = function() {
						// Replace all whitespace with pipes,
						// this is due to the rather specific way whitespace in the simple search property fields is treated (see singlepage-bls.js:getPatternString)
						// TODO discuss how we treat these fields with Jan/Katrien, see https://github.com/INL/corpus-frontend/issues/18
						actions.pattern({
							...getCurrentState(),
							value: (fr.result as string).replace(/\s+/g, '|'),
						});
					};
					fr.readAsText(file);
				} else {
					actions.pattern({
						...getCurrentState(),
						value: '', // clear value when the file is cleared
					});
				}
			});

			$caseInput.on('change', function() {
				actions.pattern({
					...getCurrentState(),
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
			const $inputs = $this.find('input, select');

			// Initialize if the field is still unknown in the store (i.e. no initial values were hydrated for this field)
			// NOTE: at this point the store should already have been initialized with initial data from page load
			if (getState().filters[id] == null) {
				actions.initFilter({
					name: id,
					filterType: type as any, // TODO enum
					values: []
				});
			}

			// Register change listener
			store.watch(state => state.filters[id], ({values}) => {
				if (type === FilterType.range) {
					$($inputs[0]).val(values[0]);
					$($inputs[1]).val(values[1]);
				} else if (type ===  FilterType.select) {
					$inputs.first().selectpicker('val', values);
				} else {
					$inputs.first().val(values);
				}
			});

			$this.on('change', function() {
				const currentState = getState().filters[id];
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
				actions.filter({id, values});
			});
		});
	}

	{ // TODO we cannot navigate to pages not in the pagination element at the moment
		const $hitDisplay = $('#tabHits');
		$hitDisplay.on('click', '[data-page]', () => {
			actions.hits.page($(this).data('page'));
		});
		store.watch(state => state.hitDisplaySettings.page, page => {
			$hitDisplay.find(`.pagination [data-page="${page}"]`).click();
		});
	}

	{ // TODO we cannot navigate to pages not in the pagination element at the moment
		const $hitDisplay = $('#tabDocs');
		$hitDisplay.on('click', '[data-page]', () => {
			actions.hits.page($(this).data('page'));
		});
		store.watch(state => state.docDisplaySettings.page, page => {
			$hitDisplay.find(`.pagination [data-page="${page}"]`).click();
		});
	}
});

/* TODO
updateFilterDisplay();
*/
