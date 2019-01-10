/**
 * This module contains the history of executed queries.
 * A new entry is created every time the user executes a query,
 * but also when the user changes the grouping, and when they switch between viewing hits/documents.
 */
import { getStoreBuilder } from 'vuex-typex';

import jsonStableStringify from 'json-stable-stringify';
import {stripIndent} from 'common-tags';

import { RootState } from '@/store';
import * as CorpusModule from '@/store/corpus';
import * as InterfaceModule from '@/store/form/interface';
import * as FilterModule from '@/store/form/filters';
import * as GlobalModule from '@/store/results/global';
import * as HitsModule from '@/store/results/hits';
import * as DocsModule from '@/store/results/docs';
import * as PatternModule from '@/store/form/patterns';
import * as ExploreModule from '@/store/form/explore';

import UrlStateParser from '@/store/util/url-state-parser';

import { NormalizedIndex } from '@/types/apptypes';
import { debugLog } from '@/utils/debug';
import { getFilterSummary } from '@/utils';

const version = 4;

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
	timestamp: number;
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
	asFile: (entry: FullHistoryEntry) => {
		const date = new Date().toLocaleString('en-EN', {
			hour12: false,
			year: '2-digit',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		const fileName = `query_${date}.txt`;
		const fileContents = stripIndent`
			# Date: ${date}
			# Results: ${entry.interface.form === 'search' ? entry.interface.viewedResults : entry.interface.exploreMode || '-'}
			# Pattern: ${entry.displayValues.pattern || '-'}
			# Filters: ${entry.displayValues.filters || '-'}
			# Grouping: ${entry[entry.interface.viewedResults!].groupBy}

			#####
			${btoa(JSON.stringify(Object.assign({version}, entry)))}
			#####`;

		const file = new Blob([fileContents], {type: 'text/plain;charset=utf-8'});
		return {file, fileName};
	},
	fromFile: (f: File) => new Promise<{entry: HistoryEntry, pattern: string, url: string}>((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = function() {
			try {
				const base64 = (fr.result as string).replace(/#.*(?:\r\n|\n|\r|$)/g, '').trim();
				let originalEntry: FullHistoryEntry&{version: number};
				try { originalEntry = JSON.parse(atob(base64)); } catch (e) { throw new Error(`Could not read query file '${f.name}'.`); }
				if (!originalEntry || originalEntry.version == null) { throw new Error('Cannot import: file does not appear to be a valid query.'); }

				// Rountrip from url if not compatible.
				const entry = originalEntry.version === version ? originalEntry : new UrlStateParser(new URI(originalEntry.url)).get();

				resolve({
					entry,
					pattern: originalEntry.displayValues.pattern,
					url: originalEntry.url
				});
			} catch (e) {
				debugLog('Cannot import query from file: ', f.name, e);
				reject(e);
			}
		};
		fr.readAsText(f);
	})
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
			timestamp: new Date().getTime(),
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
		// push new/updated entry
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
