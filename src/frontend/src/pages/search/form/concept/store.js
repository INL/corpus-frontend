
import  createStore  from 'vuex';
import Vue from 'vue';
import Vuex from 'vuex';
import { MutationTree, ActionContext, ActionTree } from 'vuex';
import { GetterTree } from 'vuex';
import axios from 'axios'

/*
// Het lukte me niet om dit in typescript te krijgen ... sorry ...
type AtomicQuery = {
  field: string;
  value: string;
};

type SingleConceptQuery = {
  terms:  AtomicQuery[];
};

interface ConceptQuery {
  [key: string]:  SingleConceptQuery;
}

type ConceptState = {
  query: ConceptQuery
};

*/

const myMutations =  { 
  setSubQuery(state, label, q) {
    state.query[label] = q ;
  },
  addTerm(state, label, atom) {
    if (!(label in state.query)) {
      state.query[label] = { terms: [] };
    };
    state.query[label].terms.push(atom);
  }
}

const myActions = {  
  async fetchUsers({ commit }) { // voorbeeldje
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
}

export const conceptStoreModule = {
  state: function() {
     const _state = { query : { } };
     return _state;
  },
  getters: { query(state) {
    return state.query;
  } },
  mutations: myMutations,
  actions: myActions
}



/*
export const conceptStore = new Vuex.Store({
  modules: {
    conceptModule: conceptStoreModule,
}});
*/

