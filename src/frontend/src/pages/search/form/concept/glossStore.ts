// gedoe ... de patternStore (src/store/search/form/patterns.ts) is een goed voorbeeldje want redelijk simpel
// Zie https://github.com/mrcrowl/vuex-typex/blob/master/src/index.ts voor de gebruikte ts implementatie

import { getStoreBuilder } from 'vuex-typex';
import { BLHitSnippet } from '@/types/blacklabtypes';
import { RootState } from '@/store/search/';
import * as PatternStore from '@/store/search/form/patterns';
import cloneDeep from 'clone-deep';

import axios from 'axios'

declare const INDEX_ID: string;

type GlossFieldType = {
	 type: string,
	 values: string[]
}

type GlossFieldDescription = {
	type: GlossFieldType,
	fieldName: string
}

const BooleanField: GlossFieldType = { //{"type":"boolean","values":["","true","false"]}
	type: 'boolean',
	values: ['', 'true', 'false']
}

const JobField: GlossFieldType = { // {"type":"boolean","values":["","logic and linguistics","meanings of the preposition in","god in logic","adjective collocations of truth"]}
	type: 'boolean',
	values: ['', 'logic and linguistics', 'meanings of the preposition in', 'god in logic', 'adjective collocations of truth']
}

const StringField: GlossFieldType = { // {"type":"string","values":[]}
	type: 'string',
	values: []
}

type Gloss = {
	[key: string]: string;
}

type GlossQuery = {
	author: string,
	corpus: string,
	parts: { [key: string]: string; }
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
	hitId: string,
	hit_first_word_id: string,
	hit_last_word_id: string
}

type BLHit = {
	docPid: string;
	end: number;
	start: number;
} & BLHitSnippet

type Hit2String = (a: BLHit) => string;
type Hit2Range = (a: BLHit) => {startid: string, endid: string};
type Settings = {
	gloss_fields: GlossFieldDescription[],
	blackparank_server: string,
	blackparank_instance: string,
	lexit_server: string,
	lexit_instance: string,
	get_hit_id: Hit2String,
	get_hit_range_id: Hit2Range,
}
type str2glossing = { [key: string]: Glossing}

type ModuleRootState = {
	glosses: str2glossing,
	gloss_query: GlossQuery,
	gloss_query_cql: string,
	current_page: string[], // ids of hits currently visible in result display
	settings: Settings,
};

/** Must be initialized from customjs */
const initialState: ModuleRootState = {
	glosses: {},
	current_page: [],
	gloss_query: {
		author: 'piet',
		corpus: 'quine',
		parts: {comment : ''}
	},
	gloss_query_cql: '',
	settings: {
		blackparank_server: '',
		blackparank_instance: 'quine',
		lexit_server: 'http://nolexit.inl.loc',
		lexit_instance: '',
		gloss_fields: [{fieldName: 'job', type: JobField}, {fieldName: 'relevant', type: BooleanField}, {fieldName: 'comment', type: StringField}],
		get_hit_id: h => h.docPid + '_' + h.start + '_' + h.end,
		get_hit_range_id: h => {
			const idz = h.match['_xmlid']
			const r = { startid: idz[0], endid: idz[idz.length-1] }
			// alert(JSON.stringify(r))
			return r
		} // dit is niet super persistent voor corpusversies....
	},
}

const defaults = initialState;

const namespace = 'glosses';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

const getState = b.state();
// intentionally empty, it's just there to prevent this module from being removed by tree-shake (i.e. left out during build)
const init = () => {};


/////////////////////////////////////////////////////////////////////////////////////////////
// getters and actions
/////////////////////////////////////////////////////////////////////////////////////////////

// TODO parameters in getters is not supported.
// The functions won't be reactive. (i.e. component won't re-evaluate automatically when the getter would return a different value)
const get = {
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
	glossQuery: b.read(s => s.gloss_query, 'gloss_query'),
	settings: b.read(s => s.settings, 'settings'),
	gloss_fields: b.read(s => s.settings.gloss_fields, 'gloss_fields'),
	get_hit_id_function: b.read(s => s.settings.get_hit_id, 'get_hit_id_function'),
};


const auth =  {'username':'user','password':'password'};

const actions = {
	flushAllGlosses: b.commit((state) => {
		state.glosses = {}
	}, 'flush_all_glosses'),

	addGlossing: b.commit((state, payload: {gloss: Glossing}) =>  {
		// tslint:disable-next-line:no-console
		 // store locally
		 state.glosses = Object.assign({}, state.glosses, {[payload.gloss.hitId]: payload.gloss})
		 console.log("add Glossing: " + JSON.stringify(payload.gloss))
		 // alert("add Glossing: " + JSON.stringify(payload.gloss))
		 // state.glosses[payload.gloss.hitId] = payload.gloss
		 // save in database
		 const request = 'request_to_load_in_database'
	}, 'add_glossing'),

	addGloss: b.commit((state, payload: {gloss: Gloss, hit: BLHit}) =>  {
		// tslint:disable-next-line:no-console
		 // store locally
		 const range = state.settings.get_hit_range_id(payload.hit)
		 const glossing: Glossing = {
			 gloss: payload.gloss,
			 author: 'piet',
			 corpus: INDEX_ID,
			 hitId: state.settings.get_hit_id(payload.hit),
			 hit_first_word_id: range.startid,
			 hit_last_word_id: range.endid
		 }
		 actions.addGlossing({gloss: glossing})
	}, 'add_gloss'),

	setOneGlossField: b.commit((state, payload: { hitId: string, fieldName: string, fieldValue: string, hit_first_word_id: string, hit_last_word_id: string})  => {
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
					corpus: INDEX_ID,
					'hitId': hitId,
					hit_first_word_id : payload.hit_first_word_id,
					hit_last_word_id: payload.hit_last_word_id
				}
			} else {
				glossing.gloss[fieldName]  = fieldValue
			}
			actions.addGlossing({gloss: glossing})
			actions.storeToDatabase({glossings: [glossing]})
	}, `set_gloss_field_value`), // als je dit twee keer doet gaat ie mis wegens dubbele dinges...

	updateCQL: b.commit((state) =>  {

		if (Object.keys(state.gloss_query.parts).length === 0) {
			state.gloss_query_cql = ''
			return
		}
		const p = state.gloss_query.parts
		const nontrivial = Object.keys(state.gloss_query.parts).filter(k => p[k] && p[k].length > 0)
		const q = {} as { [key: string]: string}
		nontrivial.forEach(n => q[n] = p[n])
		const params = {
			instance: state.settings.blackparank_instance,
			author: 'piet',
			corpus: INDEX_ID,
			query: JSON.stringify(q),
		}
		const url = `${state.settings.blackparank_server}/GlossStore`
		const z = new URLSearchParams(params) // todo hier moet ook authenticatie op?
		axios.post(url, z, { auth: auth}).then(response => {
			const glossings = response.data as Glossing[]
			//alert(JSON.stringify(glossings))
			const cql = glossings.filter(g => g.hit_first_word_id && g.hit_first_word_id.length > 3).map(g => {
				if (g.hit_first_word_id !== g.hit_last_word_id) return `([_xmlid='${g.hit_first_word_id}'][]*[_xmlid='${g.hit_last_word_id}'])`;
				else return `([_xmlid='${g.hit_first_word_id}'])`
			}).join("| ")

			state.gloss_query_cql = cql
			PatternStore.actions.glosses(state.gloss_query_cql)
			// alert(JSON.stringify(glossings))
			// alert(`Store to db gepiept (URL: ${url}) (params: ${JSON.stringify(params)})!`)
			// state.gloss_query_cql = response.data.pattern;
			// PatternStore.actions.glosses(state.gloss_query_cql)
		}).catch(e => alert(e.message))
	}, 'gloss_search_update_cql'),
	setOneGlossQueryField: b.commit((state, payload: {  fieldName: string, fieldValue: string })  => {
		const fieldName = payload.fieldName
		const fieldValue = payload.fieldValue
		state.gloss_query.parts[fieldName] = fieldValue
		// and translate query to cql......?
		//alert('Set gloss query field: ' + JSON.stringify(payload))
		actions.updateCQL()
	}, `set_gloss_queryfield_value`), // als je dit twee keer doet gaat ie mis wegens dubbele dinges...
	resetGlossQuery: b.commit((state)  => {

		state.gloss_query.parts = {}
		// and translate query to cql......?
		//alert('Set gloss query field: ' + JSON.stringify(payload))
		actions.updateCQL()
	}, `reset_gloss_query`), // als je dit twee keer doet gaat ie mis wegens dubbele dinges...

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
			corpus: INDEX_ID,
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
		//alert('Gloss Settings:' + JSON.stringify(payload))
		state.settings = payload
	} , 'gloss_load_settings'),
};

// hebben we de init nodig?
export {
	ModuleRootState,
	namespace,
	actions,
	getState,
	get,
	init,
	Gloss,
	Glossing,
	Settings,
	GlossFieldType,
	GlossFieldDescription
}


