import * as $ from 'jquery';

import {getState, store, actions} from './state';

import {populateQueryBuilder} from '../../search';  // FIXME extract into querybuilder module
import { PropertyField } from '../../types/pagetypes';

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
			$querybox.val(v as string);
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
		$('.propertyfield').each((i, el) => {
			const propfield = $(el);
			const id = propfield.attr('id')!;
			const $textOrSelect = propfield.find('#' + id + '_value');
			const $fileInput = propfield.find('#' + id + '_file') as JQuery<HTMLInputElement>; // NOTE: not always available
			const $caseInput = propfield.find('#' + id + '_case');

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
});
