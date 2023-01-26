
import  createStore  from 'vuex';
import { getStoreBuilder } from 'vuex-typex';
import Vue from 'vue';
import Vuex from 'vuex';
import { MutationTree, ActionContext, ActionTree } from 'vuex';
import { GetterTree } from 'vuex';
import { RootState } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { mapReduce, MapOf, multimapReduce } from '@/utils';
import { stripIndent, html } from 'common-tags';
import cloneDeep from 'clone-deep';

import axios from 'axios'


type AtomicQuery = {
  field: string;
  value: string;
};

type SingleConceptQuery = {
  terms: Set<AtomicQuery>;
};

type ConceptQuery = {
  [key: string]: SingleConceptQuery;
}

type ConceptState = {
  query: ConceptQuery
};

type ModuleRootState = ConceptState;

const myMutations =  {
  setSubQuery(state: ConceptState, label: string, q: SingleConceptQuery) {
    state.query[label] = q ;
  },
  addTerm(state: ConceptState, label: string, atom: AtomicQuery) {
    state.query[label].terms.add(atom);
  }
}


const initialState: ModuleRootState = { query: {} }

/*
export const conceptStoreModule = {
  state: function() {
     const _state = { query : { } };
     return _state;
  },
  getters: { query(state: ConceptState) {
    return state.query;
  } },
  mutations: myMutations,
  actions: {}
}
*/

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

/*
type setSubQueryArgs = {
  id: string,
  subquery: SingleConceptQuery
}

type addTermArgs = { label: string, atom: AtomicQuery }
*/

const actions = {
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
  setSubQuery: b.commit((state, payload: { id: string, subquery: SingleConceptQuery}) => state.query[payload.id] = payload.subquery, 'concept_set_subquery'),

  addTerm: b.commit((state, payload: { label: string, atom: AtomicQuery }) => {
    if (!(payload.label in state.query)) state.query[payload.label] = { terms: new Set<AtomicQuery>()};
    state.query[payload.label].terms.add(payload.atom);
  } , 'concept_add_term'),
}

const getState = (() => {
	const getter = b.state();
	return (): ModuleRootState => {
		try {
			// throws if store not built yet
			return getter();
		} catch (e) {
			// return the default state we already know
			return cloneDeep(initialState);
		}
	};
})();

const get = { // wat is hier het nut van??

};

// hebben we de init nodig?
export {
  ModuleRootState,
  namespace,
  actions,
  getState,
  get,
  AtomicQuery, SingleConceptQuery, ConceptQuery
}

/*
export const conceptStore = new Vuex.Store({
  modules: {
    conceptModule: conceptStoreModule,
}});
*/

