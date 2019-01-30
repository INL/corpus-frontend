/**
 * Contains flags/switches/filters for different parts of the ui that can be configured
 * We use this to generate customized layouts for specific corpora.
 * Is not fully-featured, and is expanded on an as-needed basis.
 *
 * Configure from external javascript through window.vuexModules.ui.getState() and assign things.
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
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
			})),
			shownAnnotations: string[];
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
			getAudioPlayerData: null,
			shownAnnotations: []
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

declare const PROPS_IN_COLUMNS: string[];

const init = () => {
	const allAnnotations = CorpusStore.get.annotationDisplayNames();
	const mainAnnotation = CorpusStore.get.firstMainAnnotation().id;

	const newInitialState: ModuleRootState = JSON.parse(JSON.stringify(initialState));
	newInitialState.explore.shownAnnotations = Object.entries(allAnnotations).map(([value, label]) => ({
		label,
		value
	}));
	newInitialState.explore.defaultAnnotation = mainAnnotation;

	// Validate or initialize shown annotations for results
	// Use PROPS_IN_COLUMNS if configured
	// Otherwise show up to the first 3 annotations as defined by their displayOrder,
	// Giving precedence to 'lemma' and 'pos' if they exist, regardless of their displayOrder
	// and omitting the default main annotation (usually 'word') - as that's always displayed.
	const shownAnnotations = PROPS_IN_COLUMNS.filter(annot => allAnnotations[annot] != null && annot !== mainAnnotation);
	if (!shownAnnotations.length) {
		// These have precedence if they exist.
		if (allAnnotations.lemma != null) { shownAnnotations.push('lemma'); }
		if (allAnnotations.pos != null) { shownAnnotations.push('pos'); }

		// Now add other annotations until we hit 3 annotations.
		Object.values(CorpusStore.getState().annotatedFields)
		.flatMap(f => f.displayOrder)
		.filter(annot => annot !== mainAnnotation && !shownAnnotations.includes(annot))
		.forEach(annot => {
			if (shownAnnotations.length < 3) {
				shownAnnotations.push(annot);
			}
		});
	}
	newInitialState.results.hits.shownAnnotations = shownAnnotations;

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
