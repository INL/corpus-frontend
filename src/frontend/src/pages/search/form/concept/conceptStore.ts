// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';
// import Vue from 'vue';
// import Vuex from 'vuex';

import { RootState, store } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';

import { settings } from './settings.js'
import cloneDeep from 'clone-deep';

import axios from 'axios'

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
  query_cql: string;
  query: ConceptQuery
};

const initialState: ModuleRootState = {
  target_element: 'p',
  query_cql: '',
  query: {
    'b0': {
      terms: [
        {
          field: 'lemma',
          value: 'apekop'
        }
      ]
    }
  }
}

const defaults = initialState;

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));
// b['_store'] = store
// alert('b=' + JSON.stringify(b) + ' commit type: ' + typeof(b.commit)  + ' .... ' + b.commit.toString())

const actions = {

  setSubQuery: b.commit((state, payload: { id: string, subquery: SingleConceptQuery}) =>  {
    console.log('whopz getting there: ' + JSON.stringify(payload.subquery));
    state.query[payload.id] = payload.subquery}, 'concept_set_subquery' ),

  addTerm: b.commit((state, payload: { label: string, atom: AtomicQuery }) => {
    if (!(payload.label in state.query)) state.query[payload.label] = { terms: new Array<AtomicQuery>() };
    state.query[payload.label].terms.push(payload.atom);
  } , 'concept_add_term'),
};

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

// zo kan de ene getter de andere niet aanroepen?
type string_plus_atomics = [string,AtomicQuery[]]
type strmap<T> =  { [key: string] : T }

function object_from_entries<T>(a: [string,T][]) : strmap<T>  {
  const o: strmap<T> = {}
  a.forEach(p => o[p[0]] = p[1])
  return o
}

const get = {

   corpus()  { return  CorpusStore.getState().id },

   // Meer gedoe dan je zou willen omdat we die Set in de state hebben. Misschien weghalen???
   translate_query_to_cql_request: () =>  {
    
    // wat is nuy het probleem??

    alert('wadde?')

    const queriesJsonArray = b.read(state => {
        const x = Object.keys(state.query).map(k => {
          alert('Key:'  + k)
          const scpj: SingleConceptQuery = state.query[k]
          //const scpj: AtomicQuery[] = Array.from(scp.terms)
          return [k, scpj]
        })
        return x
    },'goeiemorgen')()

    alert('huh?')
    // Wat gaat hier mis??

  
    const queriesJsonObject = object_from_entries(queriesJsonArray)

    const str = JSON.stringify(queriesJsonObject)
    return str

    function y(state: ModuleRootState) { return state.target_element}
    function z() { return  b.read(y) };
  
    const queryForBlackparank = {
      queries: queriesJsonObject,
      strict: true,
      element: z()
    }
    const encodedQuery = encodeURIComponent(JSON.stringify(queryForBlackparank))
    const requestUrl = `${settings.backend_server}/BlackPaRank?server=${encodeURIComponent(settings.selectedScenario.corpus_server)}&corpus=${CorpusStore.getState().id}&action=info&query=${encodedQuery}`
    return requestUrl
   }
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
  ConceptQuery
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