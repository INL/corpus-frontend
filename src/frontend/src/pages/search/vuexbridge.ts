import $ from 'jquery';
import URI from 'urijs';

// import {getState, store, actions, SearchDisplaySettings, UrlPageState, PageState} from './state';

import {store, getState, modules, actions, RootState, UrlPageState} from '@/store';

import {populateQueryBuilder} from '@/search';  // FIXME extract into querybuilder module
import { FilterField, FilterType } from '@/types/pagetypes';
import { cancelSearch } from '@/modules/singlepage-bls';
import { refreshTab, clearResults, showSearchIndicator } from '@/modules/singlepage-interface';
import {debugLog} from '@/utils/debug';

const globalActions = modules.global.actions;
const formActions = modules.form.actions;
const resultsActions = modules.results.actions;

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
		store.watch(state => state.globalSettings.pageSize, v => changeSelect($pageSize, v+''), {immediate: true});
		$pageSize.on('change', () => {
			const v = Number.parseInt($pageSize.selectpicker('val') as string, 10);
			if (v !== getState().globalSettings.pageSize) {
				modules.global.actions.pageSize(v);
			}
		});
	}

	{
		// TODO enum
		const $sampleMode = $('#sampleMode') as JQuery<HTMLSelectElement>;
		store.watch(state => state.globalSettings.sampleMode, v => changeSelect($sampleMode, v), {immediate: true});
		$sampleMode.on('change', () => {
			const v = $sampleMode.selectpicker('val') as string;
			if (v !== getState().globalSettings.sampleMode) {
				globalActions.sampleMode(v as any);
			}
		});
	}

	{
		const $sampleSize = $('#sampleSize') as JQuery<HTMLInputElement>;
		store.watch(state => state.globalSettings.sampleSize,v => changeText($sampleSize, v+''), {immediate: true});
		$sampleSize.on('change keyup', () => {
			let n: number|null = Number.parseInt($sampleSize.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().globalSettings.sampleSize) {
				globalActions.sampleSize(n);
			}
		});
	}

	{
		const $sampleSeed = $('#sampleSeed') as JQuery<HTMLInputElement>;
		store.watch(state => state.globalSettings.sampleSeed, v => changeText($sampleSeed, v), {immediate: true});
		$sampleSeed.on('change', () => {
			let n: number|null = Number.parseInt($sampleSeed.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().globalSettings.sampleSeed) {
				globalActions.sampleSeed(n);
			}
		});
	}

	{
		const $wordsAroundHit = $('#wordsAroundHit')  as JQuery<HTMLInputElement>;
		store.watch(state => state.globalSettings.wordsAroundHit, v => changeText($wordsAroundHit, v), {immediate: true});
		$wordsAroundHit.on('change keyup', e => {
			let n: number|null = Number.parseInt($wordsAroundHit.val() as string, 10);
			if (isNaN(n)) { n = null; }

			if (n !== getState().globalSettings.wordsAroundHit) {
				globalActions.wordsAroundHit(n);
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
			formActions.pattern.cql($querybox.val() as string);
		});
	}

	{
		let lastPattern: string;
		const $querybuilder = $('#querybuilder');
		store.watch(state => state.form.pattern.queryBuilder, v => {
			if (v !== lastPattern) {
				lastPattern = v || '';
				populateQueryBuilder(v);
			}
		}, {immediate: true});
		$querybuilder.on('cql:modified', () => {
			const pattern = $querybuilder.data('builder').getCql();
			lastPattern = pattern;
			formActions.pattern.queryBuilder(pattern);
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
			formActions.pattern.simple.within(value);
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
			$textOrSelect.on('change', () => formActions.pattern.simple.annotation({
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
						formActions.pattern.simple.annotation({
							id,
							value: (fr.result as string).replace(/\s+/g, '|'),
						});
					};
					fr.readAsText(file);
				} else {
					formActions.pattern.simple.annotation({
						id,
						value: '', // clear value when the file is cleared
					});
				}
			});

			// UI -> Store
			$caseInput.on('change', function() {
				formActions.pattern.simple.annotation({
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
				formActions.filter({id, values});
			});
		});
	}

	store.watch(state => state.resultSettings.viewedResults, v => {
		$('#results').toggle(!!v);
	}, {immediate: true});

	{
		$('#tabHits, #tabDocs').each((i, el) => {
			const $tab = $(el);
			const $label = $(`a[href="#${$tab.attr('id')}"`);

			const viewId = $tab.is($('#tabHits')) ? 'hits' : 'docs';
			const viewActions = modules.results[viewId].actions;
			const getViewState = () => getState().resultSettings.settings[viewId];

			// TODO result view tabs should *really* be a vue component by this point
			/** Are the search results within this tab up-to-date */
			function dirty(state?: boolean) {
				if (state == null) {
					const v = $tab.data('dirty');
					return v != null ? v : true;
				} else {
					$tab.data('dirty', state);
				}
			}

			// Main tab opening
			$label.on('show.bs.tab', () => resultsActions.viewedResults(viewId));
			store.watch(state => state.resultSettings.viewedResults, v => {
				if (v === viewId) {
					$label.tab('show');
					if (dirty()) {
						debugLog('changed to a dirty tab, refreshing');
						refreshTab($tab);
						dirty(false);
					} else {
						debugLog('changed to a clean tab, ignoring refresh');
					}
				}
			}, {immediate: true});

			// Pagination
			$tab.on('click', '[data-page]', function() { // No arrow func - need context
				const page = Number.parseInt($(this).data('page'), 10);
				if (getViewState().page !== page) {
					viewActions.page(page);
				}
			});
			store.watch(state => state.resultSettings[viewId].page, page => {
				// Only updates UI, should not be any handlers (other than directly above) attached to the ui element
				$tab.find(`.pagination [data-page="${page}"]`).click();
			}, {immediate: true});

			// Case sensitive grouping
			const $caseSensitive = $tab.find('.casesensitive') as JQuery<HTMLInputElement>;
			$caseSensitive.on('change', () => {
				const sensitive = $caseSensitive.is(':checked');
				viewActions.caseSensitive(sensitive);
			});
			store.watch(state => state.resultSettings[viewId].caseSensitive, checked => {
				changeCheck($caseSensitive, checked);
			}, {immediate: true});

			// Grouping settings
			const $groupSelect = $tab.find('.groupselect') as JQuery<HTMLSelectElement>;
			$groupSelect.on('change', () => viewActions.groupBy($groupSelect.selectpicker('val') as string[]));
			store.watch(state => state.resultSettings[viewId].groupBy, v => changeSelect($groupSelect, v), {immediate: true});

			// Sorting settings, only bind from ui to state,
			// Nothing in UI to indicate sorting -- https://github.com/INL/corpus-frontend/issues/142
			$tab.on('click', '[data-bls-sort]', function() {
				let sort = $(this).data('blsSort') as string;
				if (sort === getViewState().sort) {
					sort = '-'+sort;
				}
				viewActions.sort(sort);
				return false; // click handling
			});

			// viewgroup
			const $resultgroupdetails = $tab.find('.resultgroupdetails');
			const $resultgroupname = $tab.find('.resultgroupname');
			// delegated handler for .viewconcordances, elements are dynamically created
			$tab.on('click', '.viewconcordances', function() {
				const id = $(this).data('groupId');
				viewActions.viewGroup(id);
			});
			$tab.on('click', '.clearviewgroup', function() {
				viewActions.viewGroup(null);
			});
			store.watch(state => state.resultSettings[viewId].viewGroup, v => {
				$resultgroupdetails.toggle(v != null);
				$resultgroupname.text(v || '');
			}, {immediate: true});

			// Watch entire tab-local state and restart search when required.
			// Also need to watch some global parameters that are instantly reactive
			// NOTE: is called only once per vue tick (i.e. multiple property changes can be lumped together, such as when clearing the page)
			store.watch(state => ({
				viewParameters: state.resultSettings[viewId],
				activeView: state.resultSettings.viewedResults,
				globalParameters: state.globalSettings,
				submittedFormParameters: state.form.submittedParameters
			}), (cur, old) => {
				// Changing the display mode doesn't invalidate already rendered results...
				// Unfortunately we need to watch the operation to know if this tab just opened
				if (cur.activeView !== old.activeView) {
					debugLog('changed operation, ignoring changes (operation triggers a re-search somewhere else)', cur, old);
					return;
				}

				// if operation changed, nothing to do
				// otherwise, mark dirty, and then refresh and mark clean if it's the current tab
				dirty(true);
				if (cur.activeView === viewId) {
					refreshTab($tab);
					dirty(false);
				}
				debugLog('dynamic parameter changed', cur);
			}, {deep: true});
		});
	}

	// Reset & history navigation
	$('#mainForm').on('reset', () => {
		globalActions.reset();
		formActions.reset();
		resultsActions.reset();

		cancelSearch();

		// TODO map PageState to url and autoupdate on appropriate state updates
		const url = new URI();
		const newUrl = url.search('').segmentCoded(url.segmentCoded().filter(s => s !== 'hits' && s !== 'docs'));

		history.pushState(getState(), undefined, newUrl.toString());

		return false;
	});

	window.addEventListener('popstate', function(event) {
		let newState: RootState|undefined = event.state;
		if (newState == null) {
			newState = new UrlPageState().get();
		}

		actions.replace(newState);
	});

	// TODO restore pattern tab
	// TODO bind activePattern

	debugLog('connected state to page');
});

/* TODO
updateFilterDisplay();
*/
