// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';
// import Vue from 'vue';
// import Vuex from 'vuex';

import { RootState, store } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as PatternStore from '@/store/search/form/patterns';
import { uniq, log_error } from './utils'
import cloneDeep from 'clone-deep';

import axios from 'axios'

declare const BLS_URL: string;
const blsUrl: string = BLS_URL;

type Settings = {
  blackparank_server: string,
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
  settings: Settings,
  query_cql: string;
  query: ConceptQuery
};

type LexiconEntry = {
  field: string,
  cluster: string,
  term: string
}

const emptyQuery = {
  'b0': {
    terms: [
    ]
  }
}
const initialState: ModuleRootState = {
  target_element: 'p',
  main_fields: ['cosmology', 'alchemy', 'cryptozoology'],
  query_cql: '',
  settings: { corpus_server: 'http://nohost:8080/blacklab-server', blackparank_server: 'nohost',
  blackparank_instance: 'weetikveel', lexit_server: 'http://nolexit.inl.loc', lexit_instance: 'wadde?', searchable_elements: ['tom', 'tiedom', 'nogwat']},
  query: emptyQuery
}

const defaults = initialState;

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

// b['_store'] = store
// alert('b=' + JSON.stringify(b) + ' commit type: ' + typeof(b.commit)  + ' .... ' + b.commit.toString())
// deze getState komt uit src/store/search/ui.ts:

const getState = (() => {
	const getter = b.state();
	return (): ModuleRootState => {
		try {
			// throws if store not built yet
			return getter();
		} catch (e) {
			return cloneDeep(initialState);
		}
	};
})();

const init = () => {
	Object.assign(initialState, cloneDeep(getState()));
}

/*
type string_plus_atomics = [string,AtomicQuery[]]
type strmap<T> =  { [key: string] : T }

function object_from_entries<T>(a: [string,T][]) : strmap<T>  {
  const o: strmap<T> = {}
  a.forEach(p => o[p[0]] = p[1])
  return o
}
*/

/**
 * this is silly,  the difference needs to be eliminated between store and web service
 * Query in store: { "b0": { "terms": [ { "field": "lemma", "value": "true" }, { "field": "lemma", "value": "false" } ] }, "b1": { "terms": [ { "field": "lemma", "value": "word" } ] } }
 * Query as JSON {"element":"s","strict":true,"filter":"","queries":{"b0":[{"field":"lemma","value":"true"},{"field":"lemma","value":"false"}],"b1":[{"field":"lemma","value":"word"}]}}
 */

function reshuffle_query_for_blackparank(q: ConceptQuery, element: string): object {
   const o: {[key: string]: any} = {}
   const queries = Object.keys(q).map(k => {
     const v = q[k].terms
     o[k]  = v
   })
   return {'element': element, 'strict': true, 'filter': '', 'queries' : o}
}

function get_main_fields_url(state: ModuleRootState): string {
  const wQuery = `
        query Quine {
          lexicon(corpus : "${CorpusStore.getState().id}") {
          field
      }
    }`
  const query = `${state.settings.blackparank_server}/api?instance=${state.settings.blackparank_instance}&query=${encodeURIComponent(wQuery)}`
  // window.open(query, '_blank')
  return query
}
/////////////////////////////////////////////////////////////////////////////////////////////
// getters and actions
/////////////////////////////////////////////////////////////////////////////////////////////

// zo kan de ene getter de andere niet gebruiken?

const get = {

  corpus()  { return  CorpusStore.getState().id },

  query_cql() { return getState().query_cql },
  // Meer gedoe dan je zou willen omdat we die Set in de state hebben. Misschien weghalen???
  translate_query_to_cql_request: () =>  {

   // wat is nuy het probleem??
   const state = getState()
   // alert('wadde?' + JSON.stringify(state))

   const query = state.query
   const targetElement =  state.target_element

   // alert('huh? ' + JSON.stringify(targetElement))
   // Wat gaat hier mis??
   // const str = JSON.stringify(query)

   const queryForBlackparank = reshuffle_query_for_blackparank(query,targetElement)
   const encodedQuery = encodeURIComponent(JSON.stringify(queryForBlackparank))
   //alert(JSON.stringify(state.settings))
   const requestUrl = `${state.settings.blackparank_server}/BlackPaRank?server=${encodeURIComponent(state.settings.corpus_server)}&corpus=${CorpusStore.getState().id}&action=info&query=${encodedQuery}`
   return requestUrl
  },

  settings() {
   return getState().settings
  },

  main_fields() {
    return getState().main_fields
  }
};

const geefMee = {'headers': {'Accept':'application/json'}, 'auth': {'username':'fouke','password':'narawaseraretakunai'}}
const actions = {
  resetQuery: b.commit((state) => {
    state.query = emptyQuery
  }, 'reset_query'),

  setSubQuery: b.commit((state, payload: { id: string, subquery: SingleConceptQuery}) =>  {
    // tslint:disable-next-line:no-console
    console.log('whop whop getting there: ' + JSON.stringify(payload.subquery));
    state.query[payload.id] = payload.subquery
    const request = get.translate_query_to_cql_request()
    // alert('sending:' + request)
    axios.get(request, geefMee).then(
      response => {
        // alert('Set CQL to:' + response.data.pattern);
        state.query_cql = response.data.pattern;
        PatternStore.actions.concept(state.query_cql)
        // alert('Survived this....')
      }
    ).catch(e => {
      alert(`setSubQuery: ${e.message} on ${request}`)
    })
  }, 'concept_set_subquery'),

  addTerm: b.commit((state, payload: { label: string, atom: AtomicQuery }) => {
    if (!(payload.label in state.query)) state.query[payload.label] = { terms: new Array<AtomicQuery>() };
    state.query[payload.label].terms.push(payload.atom);
  } , 'concept_add_term'),

  setTargetElement: b.commit((state, payload: string) => {
     state.target_element = payload
  } , 'concept_set_target_element'),

  loadSettings: b.commit((state, payload: Settings) => {
    state.settings = payload
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
  } , 'concept_load_settings'),
};

// hebben we de init nodig?
export {
  ModuleRootState,
  namespace,
  actions,
  getState,
  defaults,
  get,
  init,
  AtomicQuery,
  SingleConceptQuery,
  ConceptQuery,
  LexiconEntry,
  Settings
}

/*
export const conceptStore = new Vuex.Store({
  modules: {
    conceptModule: conceptStoreModule,
}});
*/

  /*
  async fetchUsers({ commit:any }) { // voorbeeldje, niet gebruikt
    try {
      const data = await axios.get(
        "https://jsonplaceholder.typicode.com/users"
      );
      commit("SET_USERS", data.data);
    } catch (error) {
      alert(error);
      console.log(error);
    }
  },
  */