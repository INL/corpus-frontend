// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store/search/';
import * as PatternStore from '@/store/search/form/patterns';
import { uniq } from './utils'
import cloneDeep from 'clone-deep';

import axios from 'axios'
import qs from 'qs'
import Vue from 'vue';

declare const BLS_URL: string;
declare const INDEX_ID: string;

type Settings = {
	/** guaranteed not to end in '/' */
	blackparank_server: string,
	blacklab_server: string,
	blackparank_instance: string,
	corpus_server: string,
	lexit_server: string,
	lexit_instance: string,
	searchable_elements: string[]
}

type AtomicQuery = {
	field: string;
	value: string;
};

type SingleConceptQuery = {
	terms: AtomicQuery[];
};

type ConceptQuery = {
	[key: string]: SingleConceptQuery;
}

type ModuleRootState = {
	target_element: string;
	main_fields: string[]
	settings: Settings|null,
	query_cql: string;
	query: ConceptQuery
};

type LexiconEntry = {
	field: string,
	cluster: string,
	term: string
}

const emptyQuery: ConceptQuery = {
	'b0': {
		terms: []
	}
}
const initialState: ModuleRootState = {
	target_element: 'p',
	main_fields: ['cosmology', 'alchemy', 'cryptozoology'],
	query_cql: '',
	settings: null,
	query: emptyQuery
}

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

const getState = b.state();

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => { /* */ }


/**
 * this is silly,  the difference needs to be eliminated between store and web service
 * Query in store: { "b0": { "terms": [ { "field": "lemma", "value": "true" }, { "field": "lemma", "value": "false" } ] }, "b1": { "terms": [ { "field": "lemma", "value": "word" } ] } }
 * Query as JSON
 * {
 * 	"element": "s",
 * 	"strict": true,
 * 	"filter": "",
 * 	"queries": {
 * 		"b0": [{ "field": "lemma", "value": "true" }, { "field": "lemma", "value": "false" }],
 * 		"b1": [{ "field": "lemma", "value": "word" }]
 * 	}
 * }L
ID
*/


function reshuffle_query_for_blackparank(q: ConceptQuery, element: string): {element: string, strict: boolean, filter: string, queries: Record<string, AtomicQuery[]>} {
	// remove the nesting of terms.
	const queries: Record<string, AtomicQuery[]> = {};
	for (const k in q) queries[k] = q[k].terms;
	return {
		element,
		strict: true,
		filter: '',
		queries
	}
}

function get_main_fields_url(state: ModuleRootState): string {
	if (!state.settings) return '';
	const wQuery = `
				query Quine {
					lexicon(corpus : "${INDEX_ID}") {
					field
			}
		}`.replace(/\s+/g, ' ')
	return `${state.settings.blackparank_server}/api?instance=${state.settings.blackparank_instance}&query=${encodeURIComponent(wQuery)}`
	// window.open(query, '_blank')
}
/////////////////////////////////////////////////////////////////////////////////////////////
// getters and actions
/////////////////////////////////////////////////////////////////////////////////////////////

// zo kan de ene getter de andere niet gebruiken?

const get = {
	query_cql: b.read(s => s.query_cql, 'query_cql'),
	translate_query_to_cql_request: b.read(s => {
		if (!s.settings) return null;
		const query = s.query
		const targetElement =  s.target_element

		// check if we have any queries
		const hasQueries = Object.values(query).some(q => q.terms.length > 0);
		if (!hasQueries) return null;

		//alert(JSON.stringify(state.settings))
		const requestUrl = `${s.settings.blackparank_server}/BlackPaRank?${qs.stringify({
			server: s.settings.blacklab_server, /* direct IP, circumvent proxy etc. */
			corpus: INDEX_ID,
			action: 'info',
			query: JSON.stringify(reshuffle_query_for_blackparank(query, targetElement))
		})}`
		return requestUrl
	}, 'translate_query_to_cql_request'),

	settings: b.read(s => s.settings, 'settings'),
	main_fields: b.read(s => s.main_fields, 'main_fields'),
};


const actions = {
	resetQuery: b.commit((state) => {
		state.query = emptyQuery
	}, 'reset_query'),

	setSubQuery: b.commit((state, payload: { id: string, subquery: SingleConceptQuery}) =>  {
		// tslint:disable-next-line:no-console
		Vue.set(state.query, payload.id, payload.subquery);
		actions.updateCQL();
	}, 'concept_set_subquery'),

	updateCQL: b.commit(state => {
		const request =  get.translate_query_to_cql_request()
		if (!request) return;
		// alert('sending:' + request)
		axios.get(request, {
			headers: {
				Accept:'application/json'
			},
			auth: {
				username:'user',
				password:'password'
			}
		}).then(response => {
			// alert('Set CQL to:' + response.data.pattern);
			state.query_cql = response.data.pattern;
			PatternStore.actions.concept(state.query_cql)
			// alert('Survived this....')
		}).catch(e => {
			alert(`setSubQuery: ${e.message} on ${request}`)
		})
	}, 'concept_update_cql'),


	addTerm: b.commit((state, payload: { label: string, atom: AtomicQuery }) => {
		if (!(payload.label in state.query))
			Vue.set(state.query, payload.label, { terms: new Array<AtomicQuery>() });
		state.query[payload.label].terms.push(payload.atom);
	}, 'concept_add_term'),

	setTargetElement: b.commit((state, payload: string) => {
		 state.target_element = payload
		 actions.updateCQL()
	}, 'concept_set_target_element'),

	loadSettings: b.commit((state, payload: Settings) => {
		state.settings = payload;
		state.settings.blackparank_server.replace(/\/$/, '');
		state.settings.blacklab_server = state.settings.blacklab_server || BLS_URL;
		state.settings.blacklab_server.replace(/\/$/, '');
		const request = get_main_fields_url(state)
		axios.get(request).then(
			response => {
				// alert("Fields query response: " + JSON.stringify(response.data.data))
				const entries: LexiconEntry[] = response.data.data
				const fields = uniq(entries.map(x => x.field))
				state.main_fields = fields
				return fields
			}).catch(e => {
				alert(`${e.message} on ${request}`)
			})
		// En de query moet ook weer opnieuw worden gezet ...
		// alert('Settings changed, settings now: ' + JSON.stringify(state.settings))
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
	SingleConceptQuery,
	ConceptQuery,
	LexiconEntry,
	Settings
}
