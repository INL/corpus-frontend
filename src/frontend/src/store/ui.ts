/**
 * Contains flags/switches/filters for different parts of the ui that can be configured
 * We use this to generate customized layouts for specific corpora.
 * Is not fully-featured, and is expanded on an as-needed basis.
 *
 * Configure from external javascript through window.vuexModules.ui.getState() and assign things.
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as CorpusStore from '@/store/corpus';
import * as BlacklabTypes from '@/types/blacklabtypes';

type ModuleRootState = {
	search: {
		// future use
		simple: {};
		extended: {};
		advanced: {};
		expert: {};
	};

	explore: {
		/** Annotation id's to show in the explore form, all annotations are shown if this is not defined. */
		shownAnnotations: Array<{label: string, value: string}>;
		defaultAnnotation: string;
	};

	results: {
		// placeholder
		hits: {
			getAudioPlayerData: null|((corpus: string, docId: string, snippet: BlacklabTypes.BLHitSnippet) => undefined|({
				docId: string
				start: number,
				end: number,
				url: string
			}))
		};
		docs: {};
	};
};

const initialState: ModuleRootState = {
	search: {
		simple: {},
		extended: {},
		advanced: {},
		expert: {}
	},
	explore: {
		shownAnnotations: [],
		defaultAnnotation: '',
	},
	results: {
		hits: {
			getAudioPlayerData: null
		},
		docs: {}
	}
};

const namespace = 'ui';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, JSON.parse(JSON.stringify(initialState)));

// hide implementation detail
const getState = b.state();

const get = {

};

const actions = {
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, JSON.parse(JSON.stringify(payload))), 'replace'),
};

const init = () => {
	const newInitialState: ModuleRootState = JSON.parse(JSON.stringify(initialState));
	newInitialState.explore.shownAnnotations = CorpusStore.get.annotations().map(annot => ({
		label: annot.displayName,
		value: annot.id
	}));
	newInitialState.explore.defaultAnnotation = CorpusStore.get.firstMainAnnotation().id;

	actions.replace(newInitialState);
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
