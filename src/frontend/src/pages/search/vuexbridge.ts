import $ from 'jquery';
import URI from 'urijs';

import {getState, store, actions, SearchDisplaySettings, UrlPageState, PageState} from './state';

import {populateQueryBuilder} from '../../search';  // FIXME extract into querybuilder module
import { FilterField, FilterType } from '../../types/pagetypes';
import { cancelSearch } from '../../modules/singlepage-bls';

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
	function eq(a,b) {
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
	{
		const $pageSize = $('#resultsPerPage') as JQuery<HTMLSelectElement>;
		store.watch(state => state.pageSize, v => changeSelect($pageSize, v+''), {immediate: true});
		$pageSize.on('change', () => {
			const v = Number.parseInt($pageSize.selectpicker('val') as string, 10);
			if (v !== getState().pageSize) {
				actions.pageSize(v);
			}
		});
	}

	{
		// TODO enum
		const $sampleMode = $('#sampleMode') as JQuery<HTMLSelectElement>;
		store.watch(state => state.sampleMode, v => changeSelect($sampleMode, v), {immediate: true});
		$sampleMode.on('change', () => {
			const v = $sampleMode.selectpicker('val') as string;
			if (v !== getState().sampleMode) {
				actions.sampleMode(v as any);
			}
		});
	}

	{
		const $sampleSize = $('#sampleSize') as JQuery<HTMLInputElement>;
		store.watch(state => state.sampleSize,v => changeText($sampleSize, v+''), {immediate: true});
		$sampleSize.on('change keyup', () => {
			let n: number|null = Number.parseInt($sampleSize.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().sampleSize) {
				actions.sampleSize(n);
			}
		});
	}

	{
		const $sampleSeed = $('#sampleSeed') as JQuery<HTMLInputElement>;
		store.watch(state => state.sampleSeed, v => changeText($sampleSeed, v), {immediate: true});
		$sampleSeed.on('change', () => {
			let n: number|null = Number.parseInt($sampleSeed.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().sampleSeed) {
				actions.sampleSeed(n);
			}
		});
	}

	{
		const $wordsAroundHit = $('#wordsAroundHit')  as JQuery<HTMLInputElement>;
		store.watch(state => state.wordsAroundHit, v => changeText($wordsAroundHit, v), {immediate: true});
		$wordsAroundHit.on('change keyup', e => {
			let n: number|null = Number.parseInt($wordsAroundHit.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().wordsAroundHit) {
				actions.wordsAroundHit(n);
			}
		});
	}

	{
		let preventNextUpdate = false; // use some other guarding to prevent repeatedly comparing long strings
		const $querybox = $('#querybox') as JQuery<HTMLTextAreaElement>;
		store.watch(state => state.patternString, v => {
			if (!preventNextUpdate) {
				$querybox.val(v as string).change();
			}
			preventNextUpdate = false;
		}, {immediate: true});
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
				lastPattern = v || '';
				populateQueryBuilder(v);
			}
		}, {immediate: true});
		$querybuilder.on('cql:modified', () => {
			const pattern = $querybuilder.data('builder').getCql();
			lastPattern = pattern;
			actions.patternQuerybuilder(pattern);
		});
	}

	{
		const $within = $('#simplesearch_within');
		store.watch(state => state.within, v => {
			if (!v) {
				$within.find('input').first().parent().button('toggle');
			} else {
				$within.find(`input[value="${v}"]`).parent().button('toggle');
			}
		}, {immediate: true});
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
			const $caseInput = $this.find('#' + id + '_case') as JQuery<HTMLInputElement>;

			// Initialize if the field is still unknown in the store (i.e. no initial values were hydrated for this field)
			// NOTE: at this point the store is already initialized with initial data from page load
			if (getState().pattern[id] == null) {
				actions.initProperty({
					case: $caseInput.is(':checked'),
					name: id,
					value: ''
				});
			}

			// Store -> UI
			store.watch(state => state.pattern[id]!.case, v => changeCheck($caseInput, v), {immediate: true});
			store.watch(state => state.pattern[id]!.value, v => {
				if ($textOrSelect.is('select')) {
					changeSelect($textOrSelect as JQuery<HTMLSelectElement>, v);
				} else {
					changeText($textOrSelect as JQuery<HTMLInputElement>, v);
				}
			}, {immediate: true});

			// UI -> Store
			$textOrSelect.on('change', () => actions.property({
				id,
				payload: { value: $textOrSelect.val() as string || '' }
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
						actions.property({
							id,
							payload: { value: (fr.result as string).replace(/\s+/g, '|') }
						});
					};
					fr.readAsText(file);
				} else {
					actions.property({
						id,
						payload: { value: '' }, // clear value when the file is cleared
					});
				}
			});

			// UI -> Store
			$caseInput.on('change', function() {
				actions.property({
					id,
					payload: { case: $caseInput.is(':checked') }
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

			// Initialize if the field is still unknown in the store (i.e. no initial values were hydrated for this field)
			// NOTE: at this point the store is already initialized with initial data from page load
			if (getState().filters[id] == null) {
				actions.initFilter({
					name: id,
					filterType: type,
					values: []
				});
			}

			// Store -> UI
			store.watch(state => state.filters[id].values, values => {
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
				actions.filter({id, values});
			});
		});
	}

	store.watch(state => state.operation, v => {
		$('#results').toggle(!!v);
	}, {immediate: true});

	{
		$('#tabHits, #tabDocs').each((i, el) => {
			const $this = $(el);
			const $label = $(`a[href="#${$this.attr('id')}"`);
			const handlers = $this.is($('#tabHits')) ? actions.hits : actions.docs;
			const stateKey = $this.is($('#tabHits')) ? 'hitDisplaySettings' : 'docDisplaySettings';
			const operation = $this.is($('#tabHits')) ? 'hits' : 'docs';
			const getSubState = (): SearchDisplaySettings => getState()[stateKey];

			// Main tab opening
			$this.on('tabOpen', () => actions.operation(operation));
			store.watch(state => state.operation, v => {
				if (v === operation) { $label.tab('show'); }
			}, {immediate: true});

			// Pagination
			// TODO we cannot navigate to pages not in the pagination element at the moment
			$this.on('click', '[data-page]', function() { // No arrow func - need context
				const page = Number.parseInt($(this).data('page'), 10);
				if (getSubState().page !== page) {
					handlers.page(page);
				}
			});
			store.watch(state => state[stateKey].page, page => {
				$this.find(`.pagination [data-page="${page}"]`).click();
			}, {immediate: true});

			// Case sensitive grouping
			const $caseSensitive = $this.find('.casesensitive') as JQuery<HTMLInputElement>;
			$caseSensitive.on('change', () => {
				const sensitive = $caseSensitive.is(':checked');
				handlers.caseSensitive(sensitive);
			});
			store.watch(state => state[stateKey].caseSensitive, checked => {
				changeCheck($caseSensitive, checked);
			}, {immediate: true});

			// Grouping settings
			const $groupSelect = $this.find('.groupselect') as JQuery<HTMLSelectElement>;
			$groupSelect.on('change', () => {
				handlers.groupBy($groupSelect.selectpicker('val') as string[]);
			});
			store.watch(state => state[stateKey].groupBy, v => changeSelect($groupSelect, v), {immediate: true});

			// Sorting settings
			$this.on('click', '[data-bls-sort]', function() {
				let sort = $(this).data('blsSort') as string;
				if (sort === getSubState().sort) {
					sort = '-'+sort;
				}
				handlers.sort(sort);
				return false; // click handling
			});
			// Nothing in UI to update from state (TODO initiate search instead)

			// viewgroup
			const $resultgroupdetails = $this.find('.resultgroupdetails')
			const $resultgroupname = $this.find('.resultgroupname');
			// delegated handler for .viewconcordances, elements are dynamically created
			$this.on('click', '.viewconcordances', function() {
				const id = $(this).data('groupId');
				handlers.viewGroup(id);
			});
			store.watch(state => state[stateKey].viewGroup, v => {
				$resultgroupdetails.toggle(v != null);
				$resultgroupname.text(v || '');
			}, {immediate: true});

			$this.on('click', '.clearviewgroup', function() {
				handlers.viewGroup(null);
			});
		});
	}

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

	window.addEventListener('popstate', function(event) {
		const state: PageState = event.state || new UrlPageState().get();
		actions.replace(state);
		// toPageState(searchSettings || {});
	});

	// TODO restore pattern tab

	console.log('connected state to page');
});

/* TODO
updateFilterDisplay();
*/
