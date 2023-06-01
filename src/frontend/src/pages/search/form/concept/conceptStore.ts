// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store/search/';
import * as PatternStore from '@/store/search/form/patterns';
import { uniq } from './utils'
import cloneDeep from 'clone-deep';

import { init as initEndpoint, conceptApi } from '@/api';
import Vue from 'vue';

declare const BLS_URL: string;
declare const INDEX_ID: string;

type Settings = {
	/** guaranteed not to end in '/' */
	concept_server: string,
	/** For sending to the back-end of the concept/blackparank stuff. Should live in backend config probably. */
	blacklab_server: string,
	blackparank_instance: string,
	lexit_server: string,
	lexit_instance: string,
	searchable_elements: string[]
}

type AtomicQuery = {
	field: string;
	value: string;
};

type ModuleRootState = {
	target_element: string;
	main_fields: string[]
	settings: Settings|null,
	query_cql: string;
	/** One AtomicQuery[] per search box (based on index) */
	query: AtomicQuery[][]
};

type LexiconEntry = {
	field: string,
	cluster: string,
	term: string
}

const initialState: ModuleRootState = {
	target_element: 'p',
	main_fields: ['cosmology', 'alchemy', 'cryptozoology'],
	query_cql: '',
	settings: null,
	query: [[], []] // start with two boxes
}

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

const getState = b.state();

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => { /* */ }



/** TODO align query in store and in query parameters so we can just pass it along as-is. */
function reshuffle_query_for_blackparank(q: AtomicQuery[][], element: string): {element: string, strict: boolean, filter: string, queries: Record<string, AtomicQuery[]>} {
	// remove the nesting of terms.
	return {
		element,
		strict: true,
		filter: '',
		queries: q.reduce((acc, val, i) => {
			acc[i] = val;
			return acc;
		}, {} as Record<string, AtomicQuery[]>)
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////
// getters and actions
/////////////////////////////////////////////////////////////////////////////////////////////

const get = {
	query_cql: b.read(s => s.query_cql, 'query_cql'),
	settings: b.read(s => s.settings, 'settings'),
	main_fields: b.read(s => s.main_fields, 'main_fields'),
	/** Get the query for use with the backend if valid, otherwise null. */
	query_for_blackparank: b.read(s => {
		let hasValidQuery = false;
		const r: Record<string, AtomicQuery[]> = {};
		for (let i = 0; i < s.query.length; i++) {
			const q = s.query[i];
			const thisQueryIsValid = q.some(qq => qq.value);
			if (thisQueryIsValid) {
				hasValidQuery = true;
				r['b' + i] = q.filter(qq => qq.value);
			}
		}
		return hasValidQuery ? r : null;
	}, 'atomic_query'),
};

const actions = {
	resetQuery: b.commit((state) => {
		state.query = [[],[]]; // start with two boxes.
		actions.updateCQL();
	}, 'reset_query'),

	addSubquery: b.commit((state, payload: AtomicQuery[] = []) => {
		state.query.push(payload);
		actions.updateCQL();
	}, 'add_subquery'),
	removeSubquery: b.commit((state, payload?: number) => {
		payload = payload ?? state.query.length - 1;
		state.query.splice(payload, 1);
		actions.updateCQL();
	}, 'remove_subquery'),
	updateSubquery: b.commit((state, payload: {index: number, query: AtomicQuery[]}) => {
		// Use Vue.set to make sure the change is recorded, otherwise it won't be detected by Vue.
		// this can be removed when we switch to Vue 3.
		Vue.set(state.query, payload.index, payload.query);
		actions.updateCQL();
	}, 'update_subquery'),

	updateCQL: b.commit(s => {
		const query = get.query_for_blackparank();
		if (!query || !s.settings) return;
		conceptApi
			.translate_query_to_cql(s.settings.blacklab_server, INDEX_ID, s.target_element, query)
			.then(r => {
				s.query_cql = r.pattern;
				PatternStore.actions.concept(s.query_cql);
			})
			.catch(e => alert(`setSubQuery: ${e.message}}`))
	}, 'concept_update_cql'),

	setTargetElement: b.commit((state, payload: string) => {
		 state.target_element = payload
		 actions.updateCQL()
	}, 'concept_set_target_element'),

	loadSettings: b.commit((state, payload: Settings) => {
		state.settings = payload;
		state.settings.blacklab_server = (state.settings.blacklab_server || BLS_URL).replace(/\/$/, '');
		state.settings.concept_server = state.settings.concept_server.replace(/\/$/, '');
		initEndpoint('concept', state.settings.concept_server);

		conceptApi.getMainFields(state.settings.blackparank_instance, INDEX_ID)
			.then(response => state.main_fields = uniq(response.data.map(x => x.field)));
	}, 'concept_load_settings'),
};

// hebben we de init nodig?
export {
	ModuleRootState,
	namespace,
	actions,
	getState,
	get,
	init,
	AtomicQuery,
	LexiconEntry,
	Settings
}
