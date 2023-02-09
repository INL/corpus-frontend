// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';
// import Vue from 'vue';
// import Vuex from 'vuex';
import { BLDocResults, BLDocFields, BLHitSnippet, BLDocInfo } from '@/types/blacklabtypes';
import { RootState, store } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as PatternStore from '@/store/search/form/patterns';
import { uniq, log_error } from './utils'
import cloneDeep from 'clone-deep';

import axios from 'axios'
 
declare const BLS_URL: string;
const blsUrl: string = BLS_URL;

type GlossFieldType = {
   type: string,
   values: string[]
}

type GlossFieldDescription = {
  type: GlossFieldType,
  fieldName: string
}

const BooleanField: GlossFieldType = {
  type: 'boolean',
  values: ['true', 'false'] 
}

const StringField: GlossFieldType = {
  type: 'string',
  values: []
}


type Gloss = {
  [key: string]: string;
}

type Location = {
  corpus_id: string,
  document_pid: string,
  start: number,
  end: number
}

type Glossing = {
  gloss: Gloss,
  author: string,
  corpus: string,
  hitId: string
}

type BLHit = {
  docPid: string;
  end: number;
  start: number;
} & BLHitSnippet

type Hit2String = (a: BLHit) => string;

type Settings = {
  gloss_fields: GlossFieldDescription[],
  blackparank_server: string,
  blackparank_instance: string,
  corpus_server: string, // irrelevant
  lexit_server: string,
  lexit_instance: string,
  get_hit_id: Hit2String
}
type str2glossing = { [key: string]: Glossing}

type ModuleRootState = {
  glosses: str2glossing,
  current_page: string[], // ids of hits currently visible in result display
  settings: Settings,
};

const initialState: ModuleRootState = {
  glosses: {},
  current_page: [],
  settings: {
    corpus_server: 'http://nohost:8080/blacklab-server',
    blackparank_server: 'http://localhost:8080/Oefenen',
    blackparank_instance: 'quine',
    lexit_server: 'http://nolexit.inl.loc',
    lexit_instance: 'wadde?',
    gloss_fields: [{fieldName: 'relevant', type: BooleanField}, {fieldName: 'comment', type: StringField}],
    get_hit_id: h => h.docPid + '_' + h.start + '_' + h.end // dit is niet super persistent voor corpusversies....
  },
}

const defaults = initialState;

const namespace = 'glosses';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

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



/////////////////////////////////////////////////////////////////////////////////////////////
// getters and actions
/////////////////////////////////////////////////////////////////////////////////////////////

const get = {

  corpus()  { return  CorpusStore.getState().id },

  getGloss: (h: BLHit): Glossing|null =>  {
    const state = getState()
   // wat is nuy het probleem??
    const hit_id = state.settings.get_hit_id(h)
    return state.glosses[hit_id] // kan null zijn
  },
  getGlossById(hitId: string) {
    return getState().glosses[hitId]
  },
  getGlossValue(hitId: string, fieldName: string)  {
    const glosses = getState().glosses
    if (hitId in glosses) {
      const glossing: Glossing = glosses[hitId]
      const fieldValue =  glossing.gloss[fieldName];
      console.log(`Gloss GET ${hitId} ${fieldName}=${fieldValue}`)
      return fieldValue
    }
    else return ''
  },
  settings() {
   return getState().settings
  },
  gloss_fields() {
    return getState().settings.gloss_fields
  },
  get_hit_id_function() { return getState().settings.get_hit_id }
};

const geefMee = {'headers': {'Accept':'application/json'}, 'auth': {'username':'fouke','password':'narawaseraretakunai'}}

let uglyK = 0;

const auth =  {'username':'fouke','password':'narawaseraretakunai'};

const actions = {
  flushAllGlosses: b.commit((state) => {
    state.glosses = {}
  }, 'flush_all_glosses'),

  addGlossing: b.commit((state, payload: {gloss: Glossing}) =>  {
    // tslint:disable-next-line:no-console
     // store locally
     state.glosses = Object.assign({}, state.glosses, {[payload.gloss.hitId]: payload.gloss})
     // state.glosses[payload.gloss.hitId] = payload.gloss
     // save in database
     const request = 'request_to_load_in_database'
  }, 'add_glossing'),

  addGloss: b.commit((state, payload: {gloss: Gloss, hit: BLHit}) =>  {
    // tslint:disable-next-line:no-console
     // store locally
     const glossing: Glossing = {
       gloss: payload.gloss,
       author: 'piet',
       corpus: get.corpus(),
       hitId: state.settings.get_hit_id(payload.hit)
     }
     actions.addGlossing({gloss: glossing})
  }, 'add_gloss'),

  setOneGlossField: b.commit((state, payload: { hitId: string, fieldName: string, fieldValue: string})  => {
      const hitId = payload.hitId
      const fieldName = payload.fieldName
      const fieldValue = payload.fieldValue
      console.log(`Gloss SET ${hitId} ${fieldName}=${fieldValue}`)
      let glossing: Glossing = state.glosses[hitId]
      if (!glossing) {
        const gloss = {
          [fieldName]: fieldValue
        }
        glossing =   {
          'gloss': gloss,
          author: 'piet',
          corpus: get.corpus(),
          'hitId': hitId
        }
      } else {
        glossing.gloss[fieldName]  = fieldValue
      }
      actions.addGlossing({gloss: glossing})
      actions.storeToDatabase({glossings: [glossing]})
  }, `set_gloss_field_value`), // als je dit twee keer doet gaat ie mis wegens dubbele dinges...
  storeToDatabase: b.commit((state, payload: {glossings: Glossing[]}) => {
      // alert('Will try to store!')
      const params = {
            instance: state.settings.blackparank_instance,
            glossings: JSON.stringify(payload.glossings),
      }
      const url = `${state.settings.blackparank_server}/GlossStore`
      const z = new URLSearchParams(params) // todo hier moet ook authenticatie op?
      axios.post(url, z, { auth: auth}).then(r => {
         // alert(`Store to db gepiept (URL: ${url}) (params: ${JSON.stringify(params)})!`)
         }).catch(e => alert(e.message))
  }, 'store_to_list_of_glissings_to_db'),
  storeAllToDatabase: b.commit((state) => {
    const allGlossings: Glossing[] = Object.values(state.glosses)
    actions.storeToDatabase({glossings: allGlossings})
  }, 'store_to_all_to_db'),
  setCurrentPage: b.commit((state, payload: string[]) => {
    // alert('Current page hit ids: ' + JSON.stringify(payload))
    state.current_page = payload
    const params = {
          instance: state.settings.blackparank_instance,
          corpus: get.corpus(),
          author: 'piet',
          hitIds: JSON.stringify(payload),
      }
    const url = `${state.settings.blackparank_server}/GlossStore`
    const z = new URLSearchParams(params) // todo hier moet ook authenticatie op?
    axios.post(url, z, { auth: auth}).then(r => {
         // alert(`Posted page hit ids: (URL: ${url}) (params: ${JSON.stringify(params)}) (response data: ${JSON.stringify(r.data)})!`)
         const glossings = r.data as Glossing[]
         glossings.forEach(g => actions.addGlossing({gloss: g}))
         }).catch(e => alert(e.message))
  }, 'set_current_page'),
  loadSettings: b.commit((state, payload: Settings) => {
    state.settings = payload
  } , 'gloss_load_settings'),
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
  Gloss,
  Glossing,
  Settings,
  GlossFieldType,
  GlossFieldDescription
}
