/**
 * This module contains a single entry for every metadata field in this corpus.
 * It contains the current ui state for frequency list form.
 *
 * When the user actually executes the query a snapshot of the state is copied to the query module.
 */
import Vue from 'vue';
import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store/search/';
import * as CorpusModule from '@/store/search/corpus';

import { FilterDefinition } from '@/types/apptypes';

import { debugLog } from '@/utils/debug';
import { paths } from '@/api';
import { getFilterString, mapReduce, getFilterSummary } from '@/utils';

export type FilterState = {
	lucene: string|null;
	value: any|null;
	summary: string|null;
};

export type FullFilterState = FilterDefinition&FilterState;

type ModuleRootState = {
	filters: {
		[filterId: string]: FullFilterState;
	},
	filterGroups: {
		[groupId: string]: {
			groupId: string;
			filterIds: string[];
		};
	};
};

type ExternalModuleRootState = ModuleRootState['filters'];

/** Populated on store initialization and afterwards */
const initialState: ModuleRootState = {
	filters: {},
	filterGroups: {}
};

const namespace = 'filters';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, initialState));
const getState = b.state();

const get = {
	luceneQuery: b.read(state => {
		// NOTE: sort the filters so a stable query is created
		// this is important for comparing history entries
		const activeFilters: FullFilterState[] = get.activeFilters().concat().sort((l, r) => l.id.localeCompare(r.id));
		return getFilterString(activeFilters);
	} , 'luceneQuery'),
	luceneQuerySummary: b.read(state => {
		// NOTE: sort the filters so a stable query is created
		// this is important for comparing history entries
		const activeFilters: FullFilterState[] = get.activeFilters().concat().sort((l, r) => l.id.localeCompare(r.id));
		return getFilterSummary(activeFilters);
	}, 'luceneQuerySummary'),

	/** Return all filters holding a value */
	activeFilters: b.read(state => Object.values(state.filters).filter(f => !!f.lucene), 'activeFilters'),
	/** Return activeFilters as associative map instead of array */
	activeFiltersMap: b.read(state => {
		const activeFilters: FullFilterState[] = get.activeFilters();
		return mapReduce(activeFilters, 'id');
	}, 'activeFiltersMap'),

	filterGroups: b.read(state => Object.values(state.filterGroups).map(group => ({
		...group,
		filters: group.filterIds.map(id => state.filters[id])
	})), 'filterGroups'),

	filterValue(id: string) { return getState().filters[id]; },
};

const actions = {
	registerFilterGroup: b.commit((state, filterGroup: {groupId: string, filterIds: string[]}) => {
		if (filterGroup.groupId in state.filterGroups) {
			// tslint:disable-next-line
			console.warn(`Filter group ${filterGroup.groupId} already exists`);
			return;
		}

		Vue.set<ModuleRootState['filterGroups'][string]>(state.filterGroups, filterGroup.groupId, {
			groupId: filterGroup.groupId,
			filterIds: filterGroup.filterIds.filter(id => state.filters[id] != null),
		});
	}, 'registerFilterGroup'),

	registerFilter: b.commit((state, filter: FilterDefinition) => {
		if (filter.id in state.filters) {
			// tslint:disable-next-line
			console.warn(`Filter ${filter.id} already exists`);
			return;
		}

		if (filter.groupId) {
			if(!(filter.groupId in state.filterGroups)) {
				actions.registerFilterGroup({
					filterIds: [],
					groupId: filter.groupId,
				});
			}
			state.filterGroups[filter.groupId].filterIds.push(filter.id);
		}

		Vue.set<FullFilterState>(state.filters, filter.id, {...filter, value: null, lucene: null, summary: null});
	}, 'registerFilter'),

	filter: b.commit((state, {id, lucene, value, summary}: Pick<FullFilterState, 'id'|'lucene'|'value'|'summary'>) => {
		const f = state.filters[id];
		f.lucene = lucene || null;
		f.summary = summary || null;
		f.value = value != null ? value : null;
	}, 'filter'),
	filterValue: b.commit((state, {id, value}: Pick<FullFilterState, 'id'|'value'>) => state.filters[id].value = value != null ? value : null, 'filter_value'),
	filterLucene: b.commit((state, {id, lucene}: Pick<FullFilterState, 'id'|'lucene'>) => state.filters[id].lucene = lucene || null, 'filter_lucene'),
	filterSummary: b.commit((state, {id, summary}: Pick<FullFilterState, 'id'|'summary'>) => state.filters[id].summary = summary || null, 'filter_summary'),
	reset: b.commit(state => Object.values(state.filters).forEach(f => f.value = f.summary = f.lucene = null), 'filter_reset'),

	replace: b.commit((state, payload: ExternalModuleRootState) => {
		actions.reset();
		Object.values(payload).forEach(actions.filter);
	}, 'replace'),
};

const init = () => {
	CorpusModule.get.metadataGroups().forEach(g => {
		actions.registerFilterGroup({
			filterIds: g.fields.map(f => f.id),
			groupId: g.name
		});

		g.fields.forEach(f => {
			let componentName;
			let metadata: any;
			switch (f.uiType) {
				case 'checkbox':
					componentName = 'filter-checkbox';
					metadata = f.values || [];
					break;
				case 'combobox':
					componentName = 'filter-autocomplete';
					metadata = paths.autocompleteMetadata(CorpusModule.getState().id, f.id);
					break;
				case 'radio'   :
					componentName = 'filter-radio';
					metadata = f.values || [];
					break;
				case 'range'   :
					componentName = 'filter-range';
					metadata = undefined;
					break;
				case 'select'  :
					componentName = 'filter-select';
					metadata = f.values || [];
					break;
				case 'text'    :
				default        :
					componentName = 'filter-text';
					metadata = undefined;
					break;
			}

			actions.registerFilter({
				componentName,
				description: f.description,
				displayName: f.displayName,
				groupId: f.groupId,
				id: f.id,
				metadata,
			});
		});
	});

	debugLog('Finished initializing filter module state shape');
};

export {
	ExternalModuleRootState as ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
