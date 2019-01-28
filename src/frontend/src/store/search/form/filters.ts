/**
 * This module contains a single entry for every metadata field in this corpus.
 * It contains the current ui state for frequency list form.
 *
 * When the user actually executes the query a snapshot of the state is copied to the query module.
 */
import Vue from 'vue';
import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import * as CorpusModule from '@/store/search/corpus';

import {FilterValue} from '@/types/apptypes';

import {debugLog} from '@/utils/debug';

type ModuleRootState = {
	[key: string]: FilterValue;
};

const initialState: ModuleRootState = {};

const namespace = 'filters';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, initialState));
const getState = b.state();

const get = {
	/** Return all filters holding a value */
	activeFilters: b.read(state => Object.values(state).filter(f => {
		// remove empty strings
		const numValues = f.values.filter(v => !!v).length;
		// Only active when both fields filled for range, or at least a single string for select, or text non-empty
		return f.type === 'range' ? numValues === 2 : numValues > 0;
	}), 'activeFilters'),
	/** Return activeFilters as assiciative map instead of array */
	activeFiltersMap: b.read((state): ModuleRootState => {
		return get.activeFilters().reduce((acc, f) => {
			acc[f.id] = f;
			return acc;
		}, {} as ModuleRootState);
	}, 'activeFiltersMap'),

	filterValue(id: string) { return getState()[id]; },
};

const privateActions = {
	initFilter: b.commit((state, payload: FilterValue) => Vue.set(state, payload.id, payload), 'filter_init'),
};

const actions = {
	filter: b.commit((state, {id, values}: {id: string, values: string[]}) => state[id].values = values, 'filter'),
	reset: b.commit(state => Object.values(state).forEach(filter => filter.values = getInitialValue(filter.type)), 'filter_reset'),

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.reset();
		Object.values(payload).forEach(actions.filter);
	}, 'replace'),
};

const init = () => {
	CorpusModule.get.metadataGroups().flatMap(g => g.fields).forEach(m => {
		privateActions.initFilter({
			type: m.uiType,
			id: m.id,
			values: getInitialValue(m.uiType)
		});
	});

	debugLog('Finished initializing filter module state shape');
};

function getInitialValue(uiType: FilterValue['type']) {
	return uiType === 'select' ? [] :
		uiType === 'combobox' ? [] :
		uiType === 'range' ? ['',''] :
		uiType === 'checkbox' ? [] :
		['']; // normal text, radio
}

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
