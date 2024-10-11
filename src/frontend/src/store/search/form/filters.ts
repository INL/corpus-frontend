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
import * as UIStore from '@/store/search/ui';
import * as FilterStore from '@/store/search/form/filters';

import { FilterDefinition } from '@/types/apptypes';

import { debugLog } from '@/utils/debug';
import { blacklabPaths } from '@/api';
import { mapReduce, unescapeRegex } from '@/utils';
import { getFilterString, getFilterSummary, getValueFunctions, valueFunctions } from '@/components/filters/filterValueFunctions';

export type FilterState = {
	value: any|null;
};

export type FullFilterState = FilterDefinition<any, any>&FilterState;

/** A group of metadata filters (i.e. a tab in the search interface) */
export type FilterGroupType = {
	/** Name on the tab */
	tabname: string;
	/** Groups of related fields on this tab ("subtabs") */
	subtabs: Array<{
		tabname?: string;
		fields: string[];
	}>;
	/** Filter query that is always included if this filter group (tab) is active. */
	query?: Record<string, string[]>;
};

type ModuleRootState = {
	filters: {
		[filterId: string]: FullFilterState;
	},
	// Differently structured from the normal BlackLab MetadataFieldGroups, because we allow inserting subheaders between fields, and activating a query on tab activation
	filterGroups: FilterGroupType[];
};

type ExternalModuleRootState = ModuleRootState['filters'];



/** Populated on store initialization and afterwards */
const initialState: ModuleRootState = {
	filters: {},
	filterGroups: []
};

const namespace = 'filters';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, initialState));
const getState = b.state();

const get = {
	/** Return all filters holding a value */
	activeFilters: b.read(state => Object.values(state.filters).filter(f => getValueFunctions(f).isActive(f.id, f.metadata, f.value)), 'activeFilters'),
	/** Return activeFilters as associative map instead of array */
	activeFiltersMap: b.read(state => {
		const activeFilters: FullFilterState[] = get.activeFilters();
		return mapReduce(activeFilters, 'id');
	}, 'activeFiltersMap'),

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

	filterValue(id: string) { return getState().filters[id]; },
};

const actions = {
	registerFilterGroup: b.commit((state, filterGroup: {id: string, filterIds: string[]}) => {
		if (state.filterGroups.find(g => g.tabname === filterGroup.id)) {
			console.warn(`Filter group ${filterGroup.id} already exists`);
			return;
		}
		state.filterGroups.push({
			tabname: filterGroup.id,
			subtabs: [{
				tabname: undefined,
				fields: filterGroup.filterIds.filter(id => state.filters[id] != null),
			}],
		});
	}, 'registerFilterGroup'),

	registerFilter: b.commit((state, {filter, insertBefore}: {
		/** Filter definition */
		filter: FilterDefinition;
		/** Optional: ID of another filter in this group before which to insert this filter, if omitted, the filter is appended at the end. */
		insertBefore?: string;
	}) => {
		if (filter.groupId) {
			if (!state.filterGroups.find(g => g.tabname === filter.groupId)) {
				actions.registerFilterGroup({
					filterIds: [],
					id: filter.groupId,
				});
			}
			const group = state.filterGroups.find(g => g.tabname === filter.groupId)!;
			const subtabIndex = insertBefore != null && state.filters[insertBefore] ? group.subtabs.findIndex(subtab => subtab.fields.includes(insertBefore)) : 0;
			const index = subtabIndex != 0 ? group.subtabs[subtabIndex].fields.indexOf(insertBefore!) : -1;
			group.subtabs[subtabIndex].fields.splice(index !== -1 ? index : group.subtabs[subtabIndex].fields.length, 0, filter.id);
		}

		if (state.filters[filter.id]) { // already exists, might be registered twice because it's in multiple groups
			return;
		}

		// Backwards compat: we renamed these fields but not all extension scripts are upt-to-date
		//@ts-ignore
		filter.defaultDisplayName = filter.defaultDisplayName || filter.displayName;
		//@ts-ignore
		filter.defaultDisplayName = filter.defaultDescription || filter.description;

		Vue.set<FullFilterState>(state.filters, filter.id, {...filter, value: null});
	}, 'registerFilter'),

	filterValue: b.commit((state, {id, value}: Pick<FullFilterState, 'id'|'value'>) => {
		const filterObj = state.filters[id];
		if (!filterObj) {
			console.error(`Filter ${id} does not exist`);
		}
		const funcs = getValueFunctions(filterObj);
		if (funcs.onChange)
			funcs.onChange(id, filterObj.metadata, value);
		return (filterObj.value = value != null ? value : null);
	}, 'filter_value'),

	setFiltersFromWithinClauses: b.commit((state, withinClauses: Record<string, Record<string, any>>) => {
		// For each within clause...
		Object.entries(withinClauses).forEach( ([el, attr]) => {
			// For each attribute in this clause...
			Object.entries(attr ?? {}).forEach( ([attrName, attrValue]) => {
				// If it's a regex, convert it to wildcard form (pipes for multiple values are unaffected)
				const widgetValue = typeof attrValue === 'string' ? unescapeRegex(attrValue, true) : attrValue;
				// Find the matching filter and set the value
				Object.values(state.filters)
					.filter(f => f.isSpanFilter && f.metadata.name === el && f.metadata.attribute === attrName)
					.forEach(f => {
						f.value = typeof widgetValue === 'string' && f.componentName === 'filter-select' ?
								widgetValue.split('|') : widgetValue;
					});
			});
		});
	}, 'set_filters_from_within_clauses'),

	// filterLucene: b.commit((state, {id, lucene}: Pick<FullFilterState, 'id'|'lucene'>) => state.filters[id].lucene = lucene || null , 'filter_lucene'),
	// filterSummary: b.commit((state, {id, summary}: Pick<FullFilterState, 'id'|'summary'>) => state.filters[id].summary = summary || null, 'filter_summary'),
	reset: b.commit(state => Object.keys(state.filters).forEach(k => {
		state.filters[k].value = null;
	}), 'filter_reset'),

	replace: b.commit((state, payload: ExternalModuleRootState) => {
		actions.reset();
		Object.values(payload).forEach(actions.filterValue);
	}, 'replace'),
};

const init = () => {
	// Take care to copy the order of metadatagroups and their fields here!
	CorpusModule.get.metadataGroups().forEach(g => {
		actions.registerFilterGroup({
			filterIds: [],
			id: g.id
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
					metadata = blacklabPaths.autocompleteMetadata(INDEX_ID, f.id);
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
				case 'date':
					componentName = 'filter-date';
					metadata = {
						field: f.id
					}
				case 'text'    :
				default        :
					componentName = 'filter-text';
					metadata = undefined;
					break;
			}

			actions.registerFilter({
				filter: {
					componentName,
					defaultDescription: f.defaultDescription,
					defaultDisplayName: f.defaultDisplayName,
					groupId: g.id,
					id: f.id,
					metadata,
				}
			});
		});
	});

	// Make sure we register all fields in any custom tabs
	UIStore.corpusCustomizations.search.metadata.customTabs
		.map(t => ({ name: t.name, fields: t.fields ?? t.subtabs.flatMap( (s: any) => s.fields)})) // flatten subtabs
		.map(t => t.fields.map( (f: any) => ({ groupId: t.name, ...f })) ) // fill in missing groupId if any
		.flat() // flatten tabs
		.filter(f => f.id)
		.forEach(f => {
			actions.registerFilter({
				filter: f as FilterDefinition
			});
		});

	debugLog('Finished initializing filter module state shape');
};

export {
	ExternalModuleRootState as ModuleRootState,
	ModuleRootState as FullModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
