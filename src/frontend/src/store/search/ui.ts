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
import { mapReduce } from '@/utils';
import { stripIndent } from 'common-tags';

declare const PROPS_IN_COLUMNS: string[];
declare const PAGESIZE: number;

type ModuleRootState = {
	search: {
		// future use
		simple: {};
		extended: {
			splitBatch: {
				enabled: boolean;
			};
			within: {
				enabled: boolean;
				elements: Array<{
					title: string|null;
					label: string;
					value: string;
				}>;
			};
		};
		advanced: {};
		expert: {};
	};

	explore: {
		/** Annotations to show in the explore form, all (non-internal) annotations with a forward index are shown if this is not configured. */
		shownAnnotationIds: string[];
		/** Metadata fields to show in the explore form, all metadata in metadataGroups is shown if this is not configured. */
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
			/**
			 * Metadata columns to show in the hit results table.
			 * Defaults to empty.
			 */
			shownMetadataIds: string[];
		};
		docs: {
			/**
			 * Metadata columns to show in the doc results table.
			 * Defaults to the special year field (if it has been set in the index).
			 */
			shownMetadataIds: string[];
		};

		shared: {
			/**
			 * Annotations IDs to include in expanded hit rows (meaning in the table there), and csv exports containing hits.
			 * The server returns all annotations if this is null,
			 * and the interface will then display all non-internal annotations, in their displayOrder.
			 */
			detailedAnnotationIds: null|string[];
			/**
			 * Document Metadata field IDs to include in exported results.
			 * Has no influence over shown metadata in the opened documents/articles on the /docs/${docId} page.
			 * Server returns all fields if this is null.
			 */
			detailedMetadataIds: null|string[];

			/** Available options for grouping in the hits view */
			groupAnnotationIds: string[];
			/** Available metadata options for grouping in the docs view */
			groupMetadataIds: string[];

			/** Available options for sorting in the hits+docs results, only supported with a forward index */
			sortAnnotationIds: string[];
			/** Available metadata options for sorting in the hits+docs results */
			sortMetadataIds: string[];

			/** Used for calculating page offsets in links to documents */
			pageSize: number;
		};
	};

	global: {
		pageGuide: {
			enabled: boolean;
		}
	}
};

// Will be corrected on store init
// Copies values from the live store if it has been configured externally
// (which should have been verified for correctness in the action creators/handlers)
// Otherwise falls back to sensible defaults
// Then is used to initialize the live store again
const initialState: ModuleRootState = {
	search: {
		simple: {},
		extended: {
			splitBatch: {
				enabled: true,
			},
			within: {
				enabled: true,
				elements: [],
			},
		},
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
			shownMetadataIds: [],
		},
		docs: {
			shownMetadataIds: [],
		},
		shared: {
			detailedAnnotationIds: null,
			detailedMetadataIds: null,
			groupAnnotationIds: [],
			groupMetadataIds: [],
			sortAnnotationIds: [],
			sortMetadataIds: [],
			pageSize: PAGESIZE
		}
	},
	global: {
		pageGuide: {
			enabled: true
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
		extended: {
			splitBatch: {
				enable: b.commit((state, payload: boolean) => state.search.extended.splitBatch.enabled = payload, 'search_extended_splitbatch_enable'),
			},
			within: {
				enable: b.commit((state, payload: boolean) => state.search.extended.within.enabled = payload, 'search_extended_within_enable'),
				elements: b.commit((state, payload: ModuleRootState['search']['extended']['within']['elements']) => {
					// explicitly retrieve this annotations as it's supposed to be internal and thus not included in any getters.
					const field = Object.values(CorpusStore.getState().annotatedFields).find(f => 'starttag' in f.annotations);
					const annot = field ? field.annotations.starttag : undefined;
					const validValuesMap = mapReduce(annot ? annot.values : undefined, 'value');

					state.search.extended.within.elements = payload.filter(v => {
						const valid = v.value in validValuesMap;
						if (!valid) { console.warn(stripIndent`
							Trying to register element name ${v.value} for 'within' clause, but it doesn't exist in the index.
							This might happen when there are too many tags recorded in the index, but also when it just doesn't occur (or tags aren't indexed).`);
						}
					});
				}, 'search_extended_within_annotations'),
			},
		},
		advanced: {},
		expert: {},
	},
	explore: {
		shownAnnotationIds: b.commit((state, annotationIds: string[]) => {
			const allAnnotations = CorpusStore.get.allAnnotationsMap();

			const filteredIds = annotationIds.filter(id => {
				const annotsWithId = allAnnotations[id];
				const annot = annotsWithId ? annotsWithId[0] : undefined;
				if (!annot) {
					console.warn(`[UIStore.actions.explore.shownAnnotations]: Annotation with id '${id}' does not exist in corpus, ignoring...`);
					return false;
				} else if (!annot.hasForwardIndex) {
					console.warn(`[UIStore.actions.explore.shownAnnotations]: Annotation with id '${id}' has no forward index and therefor cannot be grouped, ignoring...`)
					return false;
				}
				return true;
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
			const allMetadataFields = CorpusStore.get.allMetadataFieldsMap();
			const filteredIds = metadataFieldIds.filter(id => {
				const field = allMetadataFields[id];
				if (!field) {
					console.warn(`[UIStore.actions.explore.shownMetadataFields]: Annotations with id '${id}' does not exist in corpus, ignoring...`);
					return false;
				}
				return true;
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
				const allAnnotations = CorpusStore.get.allAnnotationsMap();
				ids = ids.filter(id => {
					if (!allAnnotations[id]) {
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
			shownMetadataIds: b.commit((state, ids: string[]) => {
				const allMetadata = CorpusStore.get.allMetadataFieldsMap();
				ids = ids.filter(id => {
					if (!allMetadata[id]) {
						console.warn(`Trying to display metadata field ${id} in hits table but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				state.results.hits.shownMetadataIds = ids;
			}, 'hits_shownMetadataIds')
		},
		docs: {
			shownMetadataIds: b.commit((state, ids: string[]) => {
				const allMetadata = CorpusStore.get.allMetadataFieldsMap();
				ids = ids.filter(id => {
					if (!allMetadata[id]) {
						console.warn(`Trying to display metadata field ${id} in hits table but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				state.results.docs.shownMetadataIds = ids;
			}, 'docs_shownMetadataIds')
		},
		shared: {
			detailedAnnotationIds: b.commit((state, ids: string[]) => {
				const allAnnotations = CorpusStore.get.allAnnotationsMap();
				ids = ids.filter(id => {
					if (!allAnnotations[id]) {
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
				const allMetadataFields = CorpusStore.get.allMetadataFieldsMap();
				ids = ids.filter(id => {
					if (!allMetadataFields[id]) {
						console.warn(`Trying to add document metadata field ${id} to exports, but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				state.results.shared.detailedMetadataIds = ids;
			}, 'shared_detailedMetadataIds'),

			groupAnnotationIds: b.commit((state, ids: string[]) => {
				const allAnnotationsMap = CorpusStore.get.allAnnotationsMap();
				const allAnnotationsDisplayOrder = CorpusStore.get.allAnnotations().map(a => a.id);

				ids = ids.filter(id => {
					if (!allAnnotationsMap[id]) {
						console.warn(`Trying to allow grouping by Annotation ${id} in results, but it does not exist`);
						return false;
					} else if (!allAnnotationsMap[id][0].hasForwardIndex) {
						console.warn(`Trying to allow grouping by Annotation ${id} in results, which does not have a forward index to do so`);
						return false;
					}
					return true;
				});

				if (!ids.length) {
					return;
				}
				ids.sort((a, b) => allAnnotationsDisplayOrder.indexOf(a)-allAnnotationsDisplayOrder.indexOf(b));
				state.results.shared.groupAnnotationIds = ids;
			}, 'shared_groupAnnotationIds'),
			groupMetadataIds: b.commit((state, ids: string[]) => {
				// Yes, allow internal metadata fields if so desired
				const allMetadataFieldsDisplayOrder = CorpusStore.get.allMetadataFields().map(f => f.id);
				const allMetadataFieldsMap = CorpusStore.get.allMetadataFieldsMap();

				ids = ids.filter(id => {
					if (!allMetadataFieldsMap[id]) {
						console.warn(`Trying to allow grouping by metadata field ${id} in results, but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				ids.sort((a, b) => allMetadataFieldsDisplayOrder.indexOf(a)-allMetadataFieldsDisplayOrder.indexOf(b));
				state.results.shared.groupMetadataIds = ids;
			}, 'shared_groupMetadataIds'),
			sortAnnotationIds: b.commit((state, ids: string[]) => {
				const allAnnotationsMap = CorpusStore.get.allAnnotationsMap();
				const allAnnotationsDisplayOrder = CorpusStore.get.allAnnotations().map(a => a.id);

				ids = ids.filter(id => {
					if (!allAnnotationsMap[id]) {
						console.warn(`Trying to allow sorting by Annotation ${id} in results, but it does not exist`);
						return false;
					} else if (!allAnnotationsMap[id][0].hasForwardIndex) {
						console.warn(`Trying to allow sorting by Annotation ${id} in results, which does not have a forward index to do so`);
						return false;
					}
					return true;
				});

				if (!ids.length) {
					return;
				}
				ids.sort((a, b) => allAnnotationsDisplayOrder.indexOf(a)-allAnnotationsDisplayOrder.indexOf(b));
				state.results.shared.sortAnnotationIds = ids;
			}, 'shared_sortAnnotationIds'),
			sortMetadataIds: b.commit((state, ids: string[]) => {
				// Yes, allow internal metadata fields if so desired
				const allMetadataFieldsDisplayOrder = CorpusStore.get.allMetadataFields().map(f => f.id);
				const allMetadataFieldsMap = CorpusStore.get.allMetadataFieldsMap();

				ids = ids.filter(id => {
					if (!allMetadataFieldsMap[id]) {
						console.warn(`Trying to allow sorting by metadata field ${id} in results, but it does not exist`);
						return false;
					}
					return true;
				});
				if (!ids.length) {
					return;
				}
				ids.sort((a, b) => allMetadataFieldsDisplayOrder.indexOf(a)-allMetadataFieldsDisplayOrder.indexOf(b));
				state.results.shared.sortMetadataIds = ids;
			}, 'shared_sortMetadataIds'),
		}
	},
	global: {
		pageGuide: {
			enable: b.commit((state, payload: boolean) => {
				state.global.pageGuide.enabled = !!payload;
			}, 'global_pageGuide_enabled'),
		}
	},
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),
};

const init = () => {
	// Store can be configured by user scripts
	// This should have happened before this code runs
	// Now set the defaults based on what is configured
	// Then detect any parts that haven't been configured, and set them to some sensible defaults
	Object.assign(initialState, cloneDeep(getState()));

	const allAnnotations= CorpusStore.get.allAnnotations();
	const allAnnotationsMap = CorpusStore.get.allAnnotationsMap();
	const allShownAnnotations = CorpusStore.get.shownAnnotations();
	const allShownAnnotationsMap = CorpusStore.get.shownAnnotationsMap();

	const allMetadataFields = CorpusStore.get.allMetadataFields();
	const allMetadataFieldsMap = CorpusStore.get.allMetadataFieldsMap();
	const allShownMetadataFields = CorpusStore.get.shownMetadataFields();
	const allShownMetadataFieldsMap = CorpusStore.get.shownMetadataFieldsMap();

	const mainAnnotation = CorpusStore.get.firstMainAnnotation().id;

	if (!initialState.explore.shownAnnotationIds.length) {
		initialState.explore.shownAnnotationIds = allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id);
	}
	if (!initialState.explore.defaultAnnotationId) {
		initialState.explore.defaultAnnotationId = initialState.explore.shownAnnotationIds.includes(mainAnnotation) ? mainAnnotation : (initialState.explore.shownAnnotationIds[0] || '');
	}
	if (!initialState.explore.shownMetadataFieldIds.length) {
		initialState.explore.shownMetadataFieldIds = allShownMetadataFields.map(f => f.id);
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
		const shownAnnotations = PROPS_IN_COLUMNS.filter(annot => allAnnotationsMap[annot] != null && annot !== mainAnnotation);
		if (!shownAnnotations.length) {
			// These have precedence if they exist.
			if (allAnnotationsMap.lemma != null) { shownAnnotations.push('lemma'); }
			if (allAnnotationsMap.pos != null) { shownAnnotations.push('pos'); }

			// Now add other annotations until we hit 3 annotations.
			allShownAnnotations
			.filter(annot => annot.id !== mainAnnotation && !shownAnnotations.includes(annot.id))
			.forEach(annot => {
				if (shownAnnotations.length < 3) {
					shownAnnotations.push(annot.id);
				}
			});
		}

		initialState.results.hits.shownAnnotationIds = shownAnnotations;
	}

	if (!initialState.results.docs.shownMetadataIds.length) {
		const dateField = CorpusStore.getState().fieldInfo.dateField;
		if (dateField) {
			initialState.results.docs.shownMetadataIds.push(dateField);
		}
	}

	if (!initialState.search.extended.within.elements.length) {
		// explicitly retrieve this annotations as it's supposed to be internal and thus not included in any getters.
		const fields = allAnnotationsMap.starttag;
		const annot = fields ? fields[0] : undefined;
		const validValues = annot ? annot.values : [];

		if (validValues) {
			if (validValues.length <= 6) { // an arbitrary limit
				initialState.search.extended.within.elements = cloneDeep(validValues);
			} else {
				console.warn(`Within clause can contain ${validValues.length} different values, ignoring...`);
			}
		} else {
			console.warn('Within clause not supported in this corpus, no starttags indexed');
			initialState.search.extended.within.enabled = false;
		}
	}

	if (!initialState.results.shared.groupAnnotationIds.length) {
		// Grouping is only supported for those annotations that have a forward index
		// Use annotations in groups instead of all annotations for parity with metadata
		// See https://github.com/INL/corpus-frontend/issues/190
		// Also keep them in displayOrder for ease of use in components
		initialState.results.shared.groupAnnotationIds = allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id);
	}
	// NOTE: Show all fields in metadata groups here by default (though the user can customize fields not in groups through customjs)
	if (!initialState.results.shared.groupMetadataIds.length) {
		initialState.results.shared.groupMetadataIds = allShownMetadataFields.map(f => f.id);
	}
	if (!initialState.results.shared.sortAnnotationIds.length) {
		initialState.results.shared.sortAnnotationIds = allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id);
	}
	if (!initialState.results.shared.sortMetadataIds.length) {
		initialState.results.shared.sortMetadataIds = allShownMetadataFields.map(f => f.id);
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
