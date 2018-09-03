import * as $ from 'jquery';

import {getState, store, actions} from './state';

/*
	This is some ugly-ish code that implements some one- and two-way binding between oldschool normal html elements and the vuex store.
	Once we have all state properly updating in the store and vice versa, migrating components into vue one by one should become easy.

	The idea is to first get some basic synchronization of the jquery and vuex store working.
*/

$(document).ready(() => {
	const $pageSize = $('#resultsPerPage');
	store.watch(state => state.pageSize, v => $pageSize.selectpicker('val', '' + v));
	$pageSize.on('change', e => actions.pageSize(Number.parseInt($pageSize.selectpicker('val') as string)));

	const $sampleMode = $('#sampleMode');
	store.watch(state => state.sampleMode, v => $sampleMode.selectpicker('val', v));
	$sampleMode.on('change', e => actions.sampleMode($sampleMode.selectpicker('val') as any));
});
