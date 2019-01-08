/**
 * This module contains the history of executed queries.
 * A new entry is created every time the user executes a query,
 * but also when the user changes the grouping, and when they switch between viewing hits/documents.
 */
import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store';
import * as CorpusModule from '@/store/corpus';
import * as InterfaceModule from '@/store/form/interface';
import * as FilterModule from '@/store/form/filters';
import * as GlobalModule from '@/store/results/global';
import * as HitsModule from '@/store/results/hits';
import * as DocsModule from '@/store/results/docs';
import * as PatternModule from '@/store/form/patterns';
import * as ExploreModule from '@/store/form/explore';

import { NormalizedIndex } from '@/types/apptypes';
import { debugLog } from '@/utils/debug';
import { getFilterSummary } from '@/utils';
import jsonStableStringify from 'json-stable-stringify';

const version = 3;

type HistoryEntry = {
	// always set
	filters: FilterModule.ModuleRootState;
	global: GlobalModule.ModuleRootState;
	interface: InterfaceModule.ModuleRootState;

	// Depending on interface.viewedResults, one of these contains actual values,
	// the other contains defaults (in order to reset inactive parts of the page)
	hits: HitsModule.ModuleRootState;
	docs: DocsModule.ModuleRootState;

	// Depending on interface.form, one of these should contain the values, the other contains defaults.
	// Depending on interface.subForm, one of the subproperties is set, the others contain defaults.
	// (in order to reset inactive parts of the page)
	patterns: PatternModule.ModuleRootState;
	explore: ExploreModule.ModuleRootState;
};

export type FullHistoryEntry = HistoryEntry&{
	/** String representations of the query, for simpler displaying of the entry in UI */
	displayValues: {
		filters: string;
		pattern: string;
	};

	hash: number;
	url: string;
};

type ModuleRootState = FullHistoryEntry[];

type LocalStorageState = {
	indexLastModified: string;
	version: number;
	history: ModuleRootState;
};

const initialState: ModuleRootState = [];

const namespace = 'history';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, initialState);
let index: NormalizedIndex;

const getState = b.state();

const get = {
	//
};

const internalActions = {
	replace: b.commit((state, payload: ModuleRootState) => {
		state.splice(0, state.length, ...payload);
	}, 'replace')
};

const actions = {
	addEntry: b.commit((state, {entry, pattern, url}: {entry: HistoryEntry; pattern?: string; url: string;}) => {
		// history is updated together with page url, so we don't always receive a state we need to store.
		if (entry.interface.viewedResults == null) {
			return;
		}

		// Order needs to be consistent or hash might be different.
		const filterSummary: string = getFilterSummary(Object.values(entry.filters).sort((l, r) => l.id.localeCompare(r.id)));
		// Should only contain items that uniquely identify a query
		// Normally this would only be the pattern and filters,
		// but we've agreed that grouping differently constitutes a new query, so we also need to compare those
		const hashBase = {
			filters: filterSummary,
			pattern,
			groupBy: entry[entry.interface.viewedResults!].groupBy.concat(entry[entry.interface.viewedResults!].groupByAdvanced).sort((l, r) => l.localeCompare(r)),
		};

		const fullEntry: FullHistoryEntry = {
			...entry,
			hash: hashJavaDJB2(jsonStableStringify(hashBase)),
			url,
			displayValues: {
				filters: filterSummary || '-',
				pattern: pattern || '-'
			}
		};

		const i = state.findIndex(v => v.hash === fullEntry.hash);
		if (i !== -1) {
			// remove existing entry
			state.splice(i, 1);
		}
		// push entry
		state.unshift(fullEntry);
		// pop entries older than 40
		state.splice(40);
		saveToLocalStorage(state);
	}, 'addEntry'),
	removeEntry: b.commit((state, i: number) => {
		state.splice(i, 1);
	}, 'removeEntry')
};

const init = () => {
	index = CorpusModule.getState();
	readFromLocalStorage();
};

const readFromLocalStorage = () => {
	if (!window.localStorage) {
		return null;
	}

	const key = `cf/history/${index.id}`;
	const historyJson = window.localStorage.getItem(key);
	if (historyJson == null) {
		return null;
	}

	try {
		const state: LocalStorageState = JSON.parse(historyJson);
		if (state.indexLastModified !== index.timeModified) {
			// It could be the available annotations/metadata in the index have changed since saving the searches
			// We can't load this.
			debugLog('Index was modified in between saving and loading history, clearing history.');
			window.localStorage.removeItem(key);
			return null;
		}
		if (state.version !== version) {
			debugLog(`History out of date: read version ${state.version}, current version ${version}, clearing history.`);
			window.localStorage.removeItem(key);
			return null;
		}

		internalActions.replace(state.history);
	} catch (e) {
		debugLog('Could not read search history from localstorage', e);
	}
	return null;
};

const saveToLocalStorage = (state: ModuleRootState) => {
	if (!window.localStorage) {
		return;
	}

	const key = `cf/history/${index.id}`;
	const entry: LocalStorageState = {
		version,
		history: state,
		indexLastModified: index.timeModified
	};

	window.localStorage.setItem(key, JSON.stringify(entry));
};

// tslint:disable
function hashJavaDJB2(str: string) {
	let hash = 0;
	let i = 0;
	let char: number;
	const l = str.length;
	while (i < l) {
		char  = str.charCodeAt(i);
		hash  = ((hash<<5)-hash)+char;
		hash |= 0; // Convert to 32bit integer
		++i
	}
	return hash;
};
// tslint:enable

export {
	ModuleRootState,
	HistoryEntry,

	getState,
	get,
	actions,
	init,

	namespace,
};
