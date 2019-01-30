import Vue from 'vue';
import Vuex from 'vuex';

import {getStoreBuilder} from 'vuex-typex';

import {blacklab} from '@/api';

import * as BLTypes from '@/types/blacklabtypes';

Vue.use(Vuex);

type RootState = {
	indexId: string;
	docId: string;
	document: null|BLTypes.BLDocument;

	distributionAnnotation: null|{
		/** Id of the annotation */
		id: string;
		/** Label/displayName of the chart */
		displayName: string;
	};
	growthAnnotations: null|{
		/** Label/displayName of the chart */
		displayName: string;
		annotations: Array<{
			/** Id of the annotation */
			id: string;
			/** Label/displayName of the graph line */
			displayName: string;
		}>;
	};
	/** Injectable function to calculate whichever properties about a document */
	statisticsTableFn: null|((document: BLTypes.BLDocument, snippet: BLTypes.BLHitSnippet) => {[key: string]: string});

	baseColor: string; // TODO make ui store shared.
};

declare const INDEX_ID: string;
declare const DOCUMENT_ID: string;
const initialState: RootState = {
	indexId: INDEX_ID,
	docId: DOCUMENT_ID,
	document: null,
	distributionAnnotation: null,
	growthAnnotations: null,
	statisticsTableFn: null,
	baseColor: '#337ab7' // bootstrap primary
};

const b = getStoreBuilder<RootState>();

const getState = b.state();

const get = {
	distributionAnnotation: b.read(state => state.distributionAnnotation, 'distributionAnnotation'),
	growthAnnotations: b.read(state => state.growthAnnotations, 'growthAnnotations'),
	statisticsTableFn: b.read(state => state.statisticsTableFn, 'statisticsTableFn'),
	document: b.read(state => state.document, 'document'),
	baseColor: b.read(state => state.baseColor, 'baseColor')
};

const actions = {
	distributionAnnotation: b.commit((state, payload: RootState['distributionAnnotation']) => state.distributionAnnotation = payload, 'distributionAnnotation'),
	growthAnnotations: b.commit((state, payload: RootState['growthAnnotations']) => state.growthAnnotations = payload, 'growthAnnotations'),
	statisticsTableFn: b.commit((state, payload: RootState['statisticsTableFn']) => state.statisticsTableFn = payload, 'statisticsTableFn'),
	document: b.commit((state, payload: BLTypes.BLDocument) => state.document = payload, 'document'),
	baseColor: b.commit((state, payload: string) => state.baseColor = payload, 'baseColor'),

	reset: b.commit(state => Object.assign(state, JSON.parse(JSON.stringify(initialState))), 'resetRoot'),
	replace: b.commit((state, payload: RootState) => Object.assign(state, payload), 'replaceRoot'),
};

// shut up typescript, the state we pass here is merged with the modules initial states internally.
// NOTE: only call this after creating all getters and actions etc.
// NOTE: process.env is empty at runtime, but webpack inlines all values at compile time, so this check works.
declare const process: any;
const store = b.vuexStore({state: JSON.parse(JSON.stringify(initialState)) as RootState, strict: process.env.NODE_ENV === 'development'});

const init = () => {
	blacklab.getDocumentInfo(INDEX_ID, DOCUMENT_ID)
	.then(actions.document);
};

// Debugging helpers.
(window as any).vuexModules = {
	root: {
		store,
		getState,
		get,
		actions,
		init
	},
};

(window as any).vuexStore = store;

export {
	RootState,

	store,
	getState,
	get,
	actions,
	init,
};
