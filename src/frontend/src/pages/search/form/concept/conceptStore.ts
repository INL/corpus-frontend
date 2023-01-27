// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';
// import Vue from 'vue';
// import Vuex from 'vuex';

import { RootState, store } from '@/store/search/';
/*
import * as CorpusStore from '@/store/search/corpus';
import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { mapReduce, MapOf, multimapReduce } from '@/utils';
import { stripIndent, html } from 'common-tags';
*/

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

type ModuleRootState = {
  query: ConceptQuery
};

const initialState: ModuleRootState = {
  query: {
    'b0': {
      terms: new Set([
        {
          field: 'lemma',
          value: 'aha'
        }
      ])
    }
  }
}

const defaults = initialState;

const namespace = 'concepts';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));
// b['_store'] = store
//alert('b=' + JSON.stringify(b) + ' commit type: ' + typeof(b.commit)  + ' .... ' + b.commit.toString())

const actions = {

  setSubQuery: b.commit((state, payload: { id: string, subquery: SingleConceptQuery}) =>  {
    console.log('whopz getting there: ' + JSON.stringify(payload.subquery));
    state.query[payload.id] = payload.subquery}, 'concept_set_subquery' ),

  addTerm: b.commit((state, payload: { label: string, atom: AtomicQuery }) => {
    if (!(payload.label in state.query)) state.query[payload.label] = { terms: new Set<AtomicQuery>() };
    state.query[payload.label].terms.add(payload.atom);
  } , 'concept_add_term'),
};

// deze getter komt uit src/store/search/ui.ts

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
	// Store can be configured by user scripts.
	// This should have happened before this code runs.
	// Now set the defaults based on what is configured.
	// Then detect any parts that haven't been configured, and set them to some sensible defaults.
	// Also validate the configured settings, and replace with defaults where invalid.
	Object.assign(initialState, cloneDeep(getState()));
}

const get = { // wat is hier het nut van??

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