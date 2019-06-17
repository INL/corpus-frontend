/**
 * Contains flags/switches/filters for different parts of the ui that can be configured
 * We use this to generate customized layouts for specific corpora.
 * Is not fully-featured, and is expanded on an as-needed basis.
 *
 * Configure from external javascript through window.vuexModules.ui.getState() and assign things.
 */

import cloneDeep from 'clone-deep';
import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

type ModuleRootState = {
	search: {
		// future use
		simple: {};
		extended: {};
		advanced: {};
		expert: {};
	};

	explore: {
		/** Annotations to show in the explore form, all (non-internal) annotations are shown if this is not configured. */
		shownAnnotationIds: string[];
		/** Metadata fields to show in the explore form, all metadata in annotationGroups is shown if this is not configured. */
		shownMetadataFieldIds: string[];
		defaultAnnotationId: string;
		defaultMetadataFieldId: string;
	};

	results: {
		hits: {
			/** Function called to generate some data required to retrieve an audio file matching a hit. */
			getAudioPlayerData: null|((corpus: string, docId: string, snippet: BLTypes.BLHitSnippet) => undefined|({
				docId: string
				start: number,
				end: number,
				url: string
			})),
			/**
			 * Annotations columns to show in the hit results table, left, right and context columns are always shown.
			 * Defaults to 'lemma' and 'pos' if they exist, and up to 3 other annotations in order of their displayOrder.
			 * Can be configured through PROP_COLUMNS, which in turn is configured through search.xml.
			 * Can also be overridden at runtime by custom js.
			 */
			shownAnnotationIds: string[];
		};
		docs: {};

		shared: {
			/**
			 * Annotations IDs to include in expanded hit rows (meaning in the table there), and csv exports containing hits.
			 * Defaults to all (non-internal) annotations.
			 * By default, annotations are ordered according to their displayOrder in their AnnotatedField.
			 */
			detailedAnnotationIds: string[];
			/**
			 * Document Metadata field IDs to include in exported results.
			 * Has no influence over shown metadata in the opened documents/articles on the /docs/${docId} page.
			 * Defaults to all fields.
			 */
			detailedMetadataIds: string[];
		};
	};
};

// Will be corrected on store init
// Copies values from the live store if it has been configured externally
// (which should have been verified for correctness in the action creators/handlers)
// Otherwise falls back to sensible defaults
// Then is used to initialize the live store again
const initialState: ModuleRootState = {
	search: {
		simple: {},
		extended: {},
		advanced: {},
		expert: {}
	},
	explore: {
		shownAnnotationIds: [],
		shownMetadataFieldIds: [],
		defaultAnnotationId: '',
		defaultMetadataFieldId: ''
	},
	results: {
		hits: {
			getAudioPlayerData: null,
			shownAnnotationIds: [],
		},
		docs: {},
		shared: {
			detailedAnnotationIds: [],
			detailedMetadataIds: []
		}
	}
};

const namespace = 'ui';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

// hide implementation detail
// Sometimes this is used before store is actually created (in order to initialize other parts of the store)
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

const get = {

};

const actions = {
	search: {
		simple: {},
		extended: {},
		advanced: {},
		expert: {},
	},
	explore: {
		shownAnnotationIds: b.commit((state, annotationIds: string[]) => {
			const allAnnotations = CorpusStore.get.annotationsMap();

			const filteredIds = annotationIds.filter(id => {
				const annotsWithId = allAnnotations[id];
				const annot = annotsWithId ? annotsWithId[0] : undefined;
				if (!annot) {
					// tslint:disable-next-line
					console.warn(`[UIStore.actions.explore.shownAnnotations]: Annotation with id '${id}' does not exist in corpus, ignoring...`);
				} else if (!annot.hasForwardIndex) {
					// tslint:disable-next-line
					console.warn(`[UIStore.actions.explore.shownAnnotations]: Annotation with id '${id}' has no forward index and therefor cannot be grouped, ignoring...`)
				}
				return !!annot;
			});

			if (filteredIds.length === 0) {
				return;
			}

			let defaultId = state.explore.defaultAnnotationId;
			defaultId = filteredIds.includes(defaultId) ? defaultId : filteredIds.length ? filteredIds[0] : '';

			state.explore.shownAnnotationIds = filteredIds;
			state.explore.defaultAnnotationId = defaultId;
		}, 'explore_shownAnnotationIds'),
		defaultAnnotationId: b.commit((state, annotationId: string) => {
			if (state.explore.shownAnnotationIds.includes(annotationId)) {
				state.explore.defaultAnnotationId = annotationId;
			}
		}, 'explore_defaultAnnotationId'),

		shownMetadataFieldIds: b.commit((state, metadataFieldIds: string[]) => {
			const allMetadataFields = CorpusStore.getState().metadataFields;
			const filteredIds = metadataFieldIds.filter(id => {
				const field = allMetadataFields[id];
				if (!field) {
					// tslint:disable-next-line
					console.warn(`[UIStore.actions.explore.shownMetadataFields]: Annotations with id '${id}' does not exist in corpus, ignoring...`);
				}
				return !!field;
			});

			if (!filteredIds.length) {
				return;
			}

			let defaultId = state.explore.defaultMetadataFieldId;
			defaultId = filteredIds.includes(defaultId) ? defaultId : filteredIds.length ? filteredIds[0] : '';
			state.explore.shownMetadataFieldIds = filteredIds;
			state.explore.defaultMetadataFieldId = defaultId;
		}, 'explore_shownMetadataFieldIds'),
		defaultMetadataFieldId: b.commit((state, metadataFieldId: string) => {
			if (state.explore.shownMetadataFieldIds.includes(metadataFieldId)) {
				state.explore.defaultMetadataFieldId = metadataFieldId;
			}
		}, 'explore_defaultMetadataFieldId')
	},
	results: {
		hits: {
			shownAnnotationIds: b.commit((state, ids: string[]) => {
				const allAnnotations = CorpusStore.get.annotationDisplayNames();
				ids = ids.filter(id => {
					if (!allAnnotations[id]) {
						// tslint:disable-next-line
						console.warn(`Trying to display Annotation ${id} in hits table but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				state.results.hits.shownAnnotationIds = ids;
			}, 'hits_shownAnnotationIds'),
		},
		shared: {
			detailedAnnotationIds: b.commit((state, ids: string[]) => {
				const allAnnotations = CorpusStore.get.annotationDisplayNames();
				ids = ids.filter(id => {
					if (!allAnnotations[id]) {
						// tslint:disable-next-line
						console.warn(`Trying to display Annotation ${id} in expanded hit rows, but it does not exist`);
						return false;
					}
					return true;
				});

				if (!ids.length) {
					return;
				}
				state.results.shared.detailedAnnotationIds = ids;
			}, 'shared_detailedAnnotationIds'),

			detailedMetadataIds: b.commit((state, ids: string[]) => {
				const allMetadataFields = CorpusStore.getState().metadataFields;
				ids = ids.filter(id => {
					if (!allMetadataFields[id]) {
						// tslint:disable-next-line
						console.warn(`Trying to add document metadata field ${id} to exports, but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				state.results.shared.detailedMetadataIds = ids;
			}, 'shared_detailedMetadataIds')
		}
	},
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),
};

declare const PROPS_IN_COLUMNS: string[];

const init = () => {
	// Store can be configured by user scripts
	// This should have happened before this code runs
	// Now set the defaults based on what is configured
	// Then detect any parts that haven't been configured, and set them to some sensible defaults
	Object.assign(initialState, cloneDeep(getState()));

	const allAnnotations = CorpusStore.get.annotationsMap();
	const mainAnnotation = CorpusStore.get.firstMainAnnotation().id;

	if (!initialState.explore.shownAnnotationIds.length) {
		initialState.explore.shownAnnotationIds = CorpusStore.get.annotations().filter(a => !a.isInternal && a.hasForwardIndex).map(a => a.id);
	}
	if (!initialState.explore.defaultAnnotationId) {
		initialState.explore.defaultAnnotationId = initialState.explore.shownAnnotationIds.includes(mainAnnotation) ? mainAnnotation : (initialState.explore.shownAnnotationIds[0] || '');
	}
	if (!initialState.explore.shownMetadataFieldIds.length) {
		initialState.explore.shownMetadataFieldIds = Object.values(CorpusStore.get.metadataGroups()).flatMap(g => g.fields.map(f => f.id));
	}
	if (!initialState.explore.defaultMetadataFieldId) {
		initialState.explore.defaultMetadataFieldId = initialState.explore.shownMetadataFieldIds[0] || '';
	}

	// Initialize shown annotations for results
	// Use PROPS_IN_COLUMNS if configured
	// Otherwise show up to the first 3 annotations as defined by their displayOrder,
	// Giving precedence to 'lemma' and 'pos' if they exist, regardless of their displayOrder
	// and omitting the default main annotation (usually 'word') - as that's always displayed.
	if (!initialState.results.hits.shownAnnotationIds.length) {
		const shownAnnotations = PROPS_IN_COLUMNS.filter(annot => allAnnotations[annot] != null && annot !== mainAnnotation);
		if (!shownAnnotations.length) {
			// These have precedence if they exist.
			if (allAnnotations.lemma != null) { shownAnnotations.push('lemma'); }
			if (allAnnotations.pos != null) { shownAnnotations.push('pos'); }

			// Now add other annotations until we hit 3 annotations.
			Object.values(CorpusStore.getState().annotatedFields)
			.flatMap(f => {
				const annots = Object.values(f.annotations);
				const order = f.displayOrder;
				return annots.filter(a => !a.isInternal).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
			})
			.filter(annot => annot.id !== mainAnnotation && !shownAnnotations.includes(annot.id))
			.forEach(annot => {
				if (shownAnnotations.length < 3) {
					shownAnnotations.push(annot.id);
				}
			});
		}

		initialState.results.hits.shownAnnotationIds = shownAnnotations;
	}

	// Same story as detailedAnnotationIds, but use all annotations instead of only the first 3
	if (!initialState.results.shared.detailedAnnotationIds.length) {
		initialState.results.shared.detailedAnnotationIds =
		Object.values(CorpusStore.getState().annotatedFields)
		.flatMap(f => {
			const annots = Object.values(f.annotations);
			const order = f.displayOrder;
			return annots.filter(a => !a.isInternal).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
		})
		.map(annot => annot.id);
	}

	// Also set all metadata fields here.
	if (!initialState.results.shared.detailedMetadataIds.length) {
		const metaFieldOrder = CorpusStore.getState().metadataFieldGroups.flatMap(g => g.fields);
		const otherFields = new Set(Object.keys(CorpusStore.getState().metadataFields));
		metaFieldOrder.forEach(id => otherFields.delete(id)); // already accounted for
		metaFieldOrder.push(...otherFields);

		initialState.results.shared.detailedMetadataIds = metaFieldOrder;
	}

	actions.replace(cloneDeep(initialState));
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
