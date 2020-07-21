/**
 * Contains flags/switches/filters for different parts of the ui that can be configured
 * We use this to generate customized layouts for specific corpora.
 * Is not fully-featured, and is expanded on an as-needed basis.
 *
 * Configure from external javascript through window.vuexModules.ui.getState() and assign things.
 */

import cloneDeep from 'clone-deep';
import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import { mapReduce, MapOf, multimapReduce } from '@/utils';
import { stripIndent, html } from 'common-tags';

declare const PROPS_IN_COLUMNS: string[];
declare const PAGESIZE: number|undefined;

type ModuleRootState = {
	search: {
		// future use
		simple: {};
		extended: {
			/** Available annotation inputs in the extended search */
			searchAnnotationIds: string[],
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
		advanced: {
			enabled: boolean,
			/** Annotation selection options in querybuilder. Sorted by global annotation order. */
			searchAnnotationIds: string[];
			defaultSearchAnnotationId: string;
		};
		expert: {};

		shared: {
			/**
			 * Fields available in the filters view. Sorted by global metadata order.
			 * This does not contain custom filters.
			 * NOTE THAT THIS MAY CONTAIN IDS THAT ARE NOT A METADATA FIELD.
			 * The reason for this is custom filters.
			 * We cannot reasonably validate this, so we only output a warning when you're trying to register those.
			 * This remains a bit of a TODO but it requires some deep thinking and architectural changes.
			 */
			searchMetadataIds: string[];
		}
	};

	explore: {
		/** Default selection in the ngram token dropdowns */
		defaultSearchAnnotationId: string;
		/** Options in the ngram token dropdowns. Sorted by global annotation order. */
		searchAnnotationIds: string[];

		/** Default selection in "N-Gram type" and "Frequency list type", available options are defined by results.shared.groupAnnotationIds */
		defaultGroupAnnotationId: string;
		/** Default selection in Group documents by metadata" (Corpora tab), available options are defined by results.shared.groupMetadataIds */
		defaultGroupMetadataId: string;
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
			 * If manually configured, order from configuration is preserved. Otherwise uses the global annotation order.
			 */
			shownAnnotationIds: string[];
			/**
			 * Metadata columns to show in the hit results table.
			 * Defaults to empty.
			 * If manually configured, order from configuration is preserved. Otherwise uses the global metadata order.
			 */
			shownMetadataIds: string[];
		};
		docs: {
			/**
			 * Metadata columns to show in the doc results table.
			 * Defaults to the special year field (if it has been set in the index).
			 * If manually configured, order from configuration is preserved. Otherwise uses the global annotation order.
			 */
			shownMetadataIds: string[];
		};

		shared: {
			/** What annotation to use for displaying of [before, hit, after] and snippets. Conventionally the main annotation. */
			concordanceAnnotationId: string;
			/** Optionally run a function on all retrieved snippets to arbitrarily process the data (we use this to format the values in some annotations for display purposes). */
			transformSnippets: null|((snippet?: BLTypes.BLHitSnippet|BLTypes.BLHitSnippet[]) => void);
			concordanceAsHtml: boolean;

			/**
			 * Annotations IDs to include in expanded hit rows (meaning in the table there), and csv exports containing hits.
			 * The server returns all annotations if this is null,
			 * and the interface will then display all non-internal annotations, in their displayOrder.
			 * Sorted by global annotation order.
			 */
			detailedAnnotationIds: null|string[];
			/**
			 * Document Metadata field IDs to include in exported results.
			 * Has no influence over shown metadata in the opened documents/articles on the /docs/${docId} page.
			 * Server returns all fields if this is null.
			 * Sorted by global metadata order.
			 */
			detailedMetadataIds: null|string[];

			/**
			 * Available options for grouping by annotation, in Explore//N-grams, Explore//Statistics, and the Per Hit results.
			 * Annotations must contain a forward index.
			 * Sorted by global annotation order.
			 */
			groupAnnotationIds: string[];
			/** Available options for grouping by metadata, in Explore//Corpora, and the Per Hit/Per Doc results. Sorted by global metadata order. */
			groupMetadataIds: string[];

			/** Available options for sorting in the hits+docs results, only supported with a forward index. Sorted by global annotation order. */
			sortAnnotationIds: string[];
			/** Available metadata options for sorting in the hits+docs results. Sorted by global metadata order. */
			sortMetadataIds: string[];

			/** Used for calculating page offsets in links to documents */
			pageSize: number|undefined;
		};
	};

	global: {
		pageGuide: {
			enabled: boolean;
		},

		/** Database to use in the lexicon service component. To allow switching early dutch/middle dutch etc. */
		lexiconDb: string;
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
			searchAnnotationIds: [],
			splitBatch: {
				enabled: true,
			},
			within: {
				enabled: true,
				elements: [],
			},
		},
		advanced: {
			enabled: true,
			searchAnnotationIds: [],
			defaultSearchAnnotationId: ''
		},
		expert: {},

		shared: {
			searchMetadataIds: [],
		}
	},
	explore: {
		defaultSearchAnnotationId: '',
		searchAnnotationIds: [],

		defaultGroupAnnotationId: '',
		defaultGroupMetadataId: '',
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
			concordanceAnnotationId: '',
			transformSnippets: null,
			concordanceAsHtml: false,

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
		},
		lexiconDb: 'lexiconservice_mnw_wnt'
	},
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
			searchAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
				id => `Trying to display Annotation ${id} in the extended search, but it does not exist`,
				_ => true, _ => '',
				r => state.search.extended.searchAnnotationIds = sortAnnotations(r)
			), 'search_extended_searchAnnotationIds'),

			splitBatch: {
				enable: b.commit((state, payload: boolean) => state.search.extended.splitBatch.enabled = payload, 'search_extended_splitbatch_enable'),
			},
			within: {
				enable: b.commit((state, payload: boolean) => state.search.extended.within.enabled = payload, 'search_extended_within_enable'),
				elements: b.commit((state, payload: ModuleRootState['search']['extended']['within']['elements']) => {
					// explicitly retrieve this annotations as it's supposed to be internal and thus not included in any getters.
					const annot = (CorpusStore.get.allAnnotationsMap().starttag || [])[0];
					const validValuesMap = mapReduce(annot ? annot.values : undefined, 'value');

					state.search.extended.within.elements = payload.filter(v => {
						const valid = v.value in validValuesMap;
						if (!valid) { console.warn(stripIndent`
							Trying to register element name ${v.value} for 'within' clause, but it doesn't exist in the index.
							This might happen when there are too many tags recorded in the index, but also when it just doesn't occur (or tags aren't indexed).`);
						}
						return valid;
					});
				}, 'search_extended_within_annotations'),
			},
		},
		advanced: {
			searchAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
				id => `Trying to display Annotation ${id} in the querybuilder, but it does not exist`,
				_ => true, _ => '',
				r => {
					r = state.search.advanced.searchAnnotationIds = sortAnnotations(r);
					const defaultId = state.search.advanced.defaultSearchAnnotationId;
					if (!r.includes(defaultId)) {
						if (defaultId) { // don't warn when it was unconfigured before (e.g. '')
							console.warn(`[search.advanced.searchAnnotationIds] - Resetting default selection from '${defaultId}' to '${r[0]}' because it's not in the configured list ${JSON.stringify(r)}`);
						}
						state.search.advanced.defaultSearchAnnotationId = r[0];
					}
				}
			), 'search_advanced_searchAnnotationIds'),
			defaultSearchAnnotationId: b.commit((state, annotationId: string) => {
				if (state.search.advanced.searchAnnotationIds.length === 0 || state.search.advanced.searchAnnotationIds.includes(annotationId)) {
					state.explore.defaultGroupAnnotationId = annotationId;
				} else {
					console.warn(`[search.advanced.defaultSearchAnnotationId] - Trying to set default selection to '${annotationId}', but it's not one of the configured options (${JSON.stringify(state.search.advanced.searchAnnotationIds)})!`);
				}
			}, 'search_advanced_defaultSearchAnnotationId'),

			enable: b.commit((state, enable: boolean) => state.search.advanced.enabled = enable, 'search_advanced_enabled'),
		},
		expert: {},

		shared: {
			searchMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to display metadata field '${id}' in the filters section, but it does not exist.`,
				_ => true, _ => '',
				r => state.search.shared.searchMetadataIds = sortMetadata(r)
			), 'search_shared_searchMetadataIds')
		}
	},
	explore: {
		defaultGroupAnnotationId: b.commit((state, annotationId: string) => {
			if (state.results.shared.groupAnnotationIds.length === 0 || state.results.shared.groupAnnotationIds.includes(annotationId)) {
				state.explore.defaultGroupAnnotationId = annotationId;
			} else {
				console.warn(`[explore.defaultGroupAnnotationId] - Trying to set default selection to '${annotationId}', but it's not one of the configured options (${JSON.stringify(state.results.shared.groupAnnotationIds)})!`);
			}
		}, 'explore_defaultGroupAnnotationId'),
		defaultGroupMetadataId: b.commit((state, metadataFieldId: string) => {
			if (state.results.shared.groupMetadataIds.length === 0 || state.results.shared.groupMetadataIds.includes(metadataFieldId)) {
				state.explore.defaultGroupMetadataId = metadataFieldId;
			} else {
				console.warn(`[explore.defaultGroupMetadataId] - Trying to set default selection to '${metadataFieldId}', but it's not one of the configured options (${JSON.stringify(state.results.shared.groupMetadataIds)})!`);
			}
		}, 'explore_defaultGroupMetadataId'),

		defaultSearchAnnotationId: b.commit((state, annotationId: string) => {
			if (state.explore.searchAnnotationIds.length === 0 || state.explore.searchAnnotationIds.includes(annotationId)) {
				state.explore.defaultSearchAnnotationId = annotationId;
			} else {
				console.warn(`[explore.defaultSearchAnnotationId] - Trying to set default selection to '${annotationId}', but it's not one of the configured options (${JSON.stringify(state.explore.searchAnnotationIds)})!`);
			}
		}, 'explore_defaultSearchAnnotationId'),
		searchAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
			id => `Trying to display Annotation ${id} in the explore view (n-grams), but it does not exist`,
			_ => true, _ => '',
			r => {
				const defaultId = state.explore.defaultSearchAnnotationId;
				r = state.explore.searchAnnotationIds = sortAnnotations(r);
				if (!r.includes(defaultId)) {
					if (defaultId) { // don't warn when it was unconfigured before (e.g. '')
						console.warn(`[explore.searchAnnotationIds] - Resetting default selection from '${defaultId}' to '${r[0]}' because it's not in the configured list ${JSON.stringify(r)}`);
					}
					state.explore.defaultSearchAnnotationId = r[0];
				}
			}
		), 'explore_searchAnnotationIds'),
	},
	results: {
		hits: {
			shownAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
				id => `Trying to display Annotation '${id}' as column in the hits table, but it does not exist`,
				a => a.hasForwardIndex,
				id => `Trying to display Annotation '${id}' as column in the hits table, but it does not have the required forward index.`,
				r => state.results.hits.shownAnnotationIds = r
			), 'hits_shownAnnotationIds'),

			shownMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to display metadata field '${id}' as column in the hits table, but it does not exist`,
				_ => true, _ => '',
				r => state.results.hits.shownMetadataIds = r
			), 'hits_shownMetadataIds')
		},
		docs: {
			shownMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to display metadata field '${id}' as column in the docs table, but it does not exist`,
				_ => true, _ => '',
				r => state.results.docs.shownMetadataIds = r
			), 'docs_shownMetadataIds')
		},
		shared: {
			concordanceAnnotationId: b.commit((state, id: string) => validateAnnotations([id],
				_ => `Trying to display Annotation '${id}' as concordance and snippet text, but it does not exist`,
				a => a.hasForwardIndex,
				_ => `Trying to display Annotation '${id}' as concordance and snippet text, but it does not have the required forward index.`,
				r => state.results.shared.concordanceAnnotationId = id
			), 'shared_concordanceAnnotationId'),
			concordanceAsHtml: b.commit((state, enable: boolean) => state.results.shared.concordanceAsHtml = enable, 'shared_concordanceAsHtml'),

			detailedAnnotationIds: b.commit((state, ids: string[]|null) => {
				if (ids != null) {
					validateAnnotations(ids,
						id => `Trying to display Annotation '${id}' in hit detail snippets, but it does not exist`,
						a => a.hasForwardIndex,
						id => `Trying to display Annotation '${id}' in hit detail snippets, but it does not have the required forward index.`,
						r => state.results.shared.detailedAnnotationIds = sortAnnotations(r)
					);
				} else {
					state.results.shared.detailedAnnotationIds = ids;
				}
			}, 'shared_detailedAnnotationIds'),

			detailedMetadataIds: b.commit((state, ids: string[]|null) => {
				if (ids != null) {
					validateMetadata(ids,
						id => `Trying to add document metadata field '${id}' to exports, but it does not exist`,
						_ => true, _ => '',
						r => state.results.shared.detailedMetadataIds = sortMetadata(r)
					);
				} else {
					state.results.shared.detailedMetadataIds = ids;
				}
			}, 'shared_detailedMetadataIds'),

			groupAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
				id => `Trying to allow grouping by Annotation '${id}', but it does not exist`,
				a => a.hasForwardIndex,
				id => `Trying to allow grouping by Annotation '${id}', but it does not have the required forward index.`,
				r => {
					const defaultId = state.explore.defaultGroupAnnotationId;
					r = state.results.shared.groupAnnotationIds = sortAnnotations(r);
					if (!r.includes(defaultId)) {
						if (defaultId) { // don't warn when it was unconfigured before (e.g. '')
							console.warn(`[results.shared.groupAnnotationIds] - Resetting default selection for explore.defaultGroupAnnotationId from '${defaultId}' to '${r[0]}' because it's not in the configured list ${JSON.stringify(r)}`);
						}
						state.explore.defaultGroupAnnotationId = r[0];
					}
				}
			), 'shared_groupAnnotationIds'),

			groupMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to allow grouping by metadata field '${id}', but it does not exist`,
				_ => true, _ => '',
				r => {
					const defaultId = state.explore.defaultGroupMetadataId;
					r = state.results.shared.groupMetadataIds = sortMetadata(r);
					if (!r.includes(defaultId)) {
						if (defaultId) { // don't warn when it was unconfigured before (e.g. '')
							console.warn(`[results.shared.groupMetadataIds] - Resetting default selection for explore.defaultGroupMetadataId from '${defaultId}' to '${r[0]}' because it's not in the configured list ${JSON.stringify(r)}`);
						}
						state.explore.defaultGroupMetadataId = r[0];
					}
				}
			), 'shared_groupMetadataIds'),

			sortAnnotationIds: b.commit((state, ids: string[]) => validateAnnotations(ids,
				id => `Trying to allow sorting by Annotation '${id}', but it does not exist`,
				a => a.hasForwardIndex,
				id => `Trying to allow sorting by Annotation '${id}', but it does not have the required forward index.`,
				r => state.results.shared.sortAnnotationIds = sortAnnotations(r)
			), 'shared_sortAnnotationIds'),

			sortMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to allow sorting by metadata field '${id}', but it does not exist`,
				_ => true, _ => '',
				r => state.results.shared.sortMetadataIds = sortMetadata(r)
			), 'shared_sortMetadataIds'),
		}
	},
	global: {
		pageGuide: {
			enable: b.commit((state, payload: boolean) => {
				state.global.pageGuide.enabled = !!payload;
			}, 'global_pageGuide_enabled'),
		},
		lexiconDb: b.commit((state, payload: string) => state.global.lexiconDb = payload, 'global_lexiconDb')
	},
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),

	helpers: {
		/**
		 * Configure many annotations at the same time. Omitted columns, or columns without any "true" values are left at their defaults.
		 * If you want to clear the defaults for a column and show nothing: configure it through the dedicated function.
		 * Call as follows:
		 * ```js
		 * configureAnnotations([
		 *     [        , 'EXTENDED',  'ADVANCED' , 'EXPLORE' , 'SORT' , 'GROUP' , 'RESULTS' , 'CONCORDANCE'],
		 *     ['word'  ,           ,             ,           , true   , true    ,           ,      true    ],
		 *     ['lemma' ,           ,             ,           , true   ,         ,           ,      true    ],
		 *     ...
		 * ]);
		 * ```
		 */
		configureAnnotations: createConfigurator({
			'EXTENDED':    ['search', 'extended', 'searchAnnotationIds'],
			'ADVANCED':    ['search', 'advanced', 'searchAnnotationIds'],
			'EXPLORE':     ['explore', 'searchAnnotationIds'],
			'SORT':        ['results', 'shared', 'sortAnnotationIds'],
			'GROUP':       ['results', 'shared', 'groupAnnotationIds'],
			'RESULTS':     ['results', 'hits', 'shownAnnotationIds'],
			'CONCORDANCE': ['results', 'shared', 'detailedAnnotationIds'],
		}),

		/**
		 * Configure many metadata fields at the same time. Columns without any "true" values are left at their defaults.
		 * Call as follows:
		 * ```js
		 * configureMetadata([
		 *     [        , 'SORT' , 'GROUP' , 'RESULTS/HITS' , 'RESULTS/DOCS' , 'EXPORT'],
		 *     ['title' , true   , true    ,                ,                ,         ],
		 *     ['date'  , true   ,         ,                ,        true    ,         ],
		 *     ...
		 * ]);
		 * ```
		 */
		configureMetadata: createConfigurator({
			'FILTER':       ['search', 'shared', 'searchMetadataIds'],
			'SORT':         ['results', 'shared', 'sortMetadataIds'],
			'GROUP':        ['results', 'shared', 'groupMetadataIds'],
			'RESULTS/HITS': ['results', 'hits', 'shownMetadataIds'],
			'RESULTS/DOCS': ['results', 'docs', 'shownMetadataIds'],
			'EXPORT':       ['results', 'shared', 'detailedMetadataIds']
		}),
	}
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

	const mainAnnotation = CorpusStore.get.firstMainAnnotation();

	// ===========
	// Search form
	// ===========

	// Annotations (extended, advanced, explore [n-grams])
	// For all unconfigured sections: show all annotations in groups (groups are defined in the index format yaml file)
	if (!initialState.search.extended.searchAnnotationIds.length) {
		actions.search.extended.searchAnnotationIds(allShownAnnotations.map(a => a.id));
	}
	if (!initialState.search.advanced.searchAnnotationIds.length) {
		actions.search.advanced.searchAnnotationIds(allShownAnnotations.map(a => a.id));
	}
	if (!initialState.explore.searchAnnotationIds.length) {
		actions.explore.searchAnnotationIds(allShownAnnotations.map(a => a.id));
	}

	// Metadata/filters (extended, advanced, expert, explore)
	// If unconfigured: show all metadata in groups (groups are defined in the index format yaml file)
	if (!initialState.search.shared.searchMetadataIds.length) {
		actions.search.shared.searchMetadataIds(allShownMetadataFields.map(f => f.id));
	}

	// "within"
	if (!initialState.search.extended.within.elements.length) {
		// explicitly retrieve this annotations as it's supposed to be internal and thus not included in any getters.
		const fields = allAnnotationsMap.starttag;
		const annot = fields ? fields[0] : undefined;
		const validValues = cloneDeep(annot && annot.values ? annot.values : []);
		validValues.forEach(v => {
			if (!v.label.trim() || v.label === v.value) {
				if (v.value === 'p') { v.label = 'paragraph'; }
				else if (v.value === 's') { v.label = 'sentence'; }
				else if (!v.value) { v.label = 'document'; }
				else { v.label = v.value; }
			}
		});

		if (validValues.length) {
			if (validValues.length <= 6) { // an arbitrary limit
				actions.search.extended.within.elements(validValues);
			} else {
				console.warn(`Within clause can contain ${validValues.length} different values, ignoring...`);
			}
		} else {
			console.warn('Within clause not supported in this corpus, no starttags indexed');
			actions.search.extended.within.enable(false);
		}
	}

	// ====================
	// Results manipulation
	// ====================

	// Annotations (sorting, grouping, display in the table columns, display in opened condordances)
	// Sorting/grouping: show all annotations in groups and that have a forward index (blacklab doesn't support sorting/grouping without FI)
	if (!initialState.results.shared.groupAnnotationIds.length) {
		actions.results.shared.groupAnnotationIds(allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id));
	}
	if (!initialState.results.shared.sortAnnotationIds.length) {
		actions.results.shared.sortAnnotationIds(allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id));
	}
	// Results table columns
	// Show 'lemma' and 'pos' (if they exist) and up to 3 more annotations in order of definition
	// OR: show based on PROPS_IN_COLUMNS [legacy support] (configured in this corpus's search.xml)
	if (!initialState.results.hits.shownAnnotationIds.length) {
		const shownAnnotations = PROPS_IN_COLUMNS.filter(annot => allAnnotationsMap[annot] != null && allAnnotationsMap[annot][0].hasForwardIndex && annot !== mainAnnotation.id);
		if (!shownAnnotations.length) {
			// These have precedence if they exist.
			if (allAnnotationsMap.lemma != null && allAnnotationsMap.lemma[0].hasForwardIndex) { shownAnnotations.push('lemma'); }
			if (allAnnotationsMap.pos != null && allAnnotationsMap.pos[0].hasForwardIndex) { shownAnnotations.push('pos'); }

			// Now add other annotations until we hit 3 annotations.
			allShownAnnotations
			.filter(annot => annot.id !== mainAnnotation.id && !shownAnnotations.includes(annot.id) && annot.hasForwardIndex)
			.forEach(annot => {
				if (shownAnnotations.length < 3) {
					shownAnnotations.push(annot.id);
				}
			});
		}
		actions.results.hits.shownAnnotationIds(shownAnnotations);
	}
	// Concordances show all non-internal annotations when not set.

	// Displaying of result context/snippets
	if (!initialState.results.shared.concordanceAnnotationId) {
		actions.results.shared.concordanceAnnotationId(mainAnnotation.hasForwardIndex ? mainAnnotation.id : allAnnotations.find(a => a.hasForwardIndex)!.id);
	}

	// Metadata
	// Sorting/grouping: show all metadata in groups
	if (!initialState.results.shared.groupMetadataIds.length) {
		actions.results.shared.groupMetadataIds(allShownMetadataFields.map(f => f.id));
	}
	if (!initialState.results.shared.sortMetadataIds.length) {
		actions.results.shared.sortMetadataIds(allShownMetadataFields.map(f => f.id));
	}

	// Results table columns
	// Hits table: Never show any metadata in the hits table
	// Docs table: Show the date column if it is configured
	if (!initialState.results.docs.shownMetadataIds.length) {
		const dateField = CorpusStore.getState().fieldInfo.dateField;
		if (dateField) {
			actions.results.docs.shownMetadataIds([dateField]);
		}
	}

	Object.assign(initialState, cloneDeep(getState()));
};

// =======================
// Some helpers
// =======================

function createConfigurator<T extends MapOf<string[]>>(proppaths: T) {
	const r = function(config: [[undefined, ...Array<keyof T>],  [string, ...Array<boolean|undefined>]]) {
		const props = config.shift() as string[];
		const propvalues = {} as {[K in keyof T]: string[]};
		Object.keys(proppaths).forEach(function(propname: keyof T) { propvalues[propname] = []; });
		(config as Array<[string, ...Array<boolean|undefined>]>).forEach(function(field) {
			const id = field[0];
			field.forEach(function(value, index) {
				const propname: string|undefined = props[index]; // undefined at index 0
				if (value && propname && proppaths[propname]) {
					propvalues[propname].push(id);
				}
			});
		});

		Object.entries(propvalues).forEach(function(entry) {
			const propname = entry[0];
			const propvalue = entry[1];
			const proppath = proppaths[propname];

			if (propvalue.length === 0) {
				return;
			}

			const propfunction = proppath.reduce(function(scope, segment) {
				return scope[segment];
			}, actions as any);

			propfunction(propvalue);
		});
	};

	r.config = proppaths;
	return r;
}

/** Validate all ids, triggering callbacks for failed ids, and triggering a final callback if there is any valid annotation. */
function validateAnnotations(
	ids: string[],
	missing: (id: string) => string,
	validate: (a: AppTypes.NormalizedAnnotation) => boolean,
	invalid: (id: string) => string,
	cb: (ids: string[]) => void
) {
	// tslint:disable
	const all = CorpusStore.get.allAnnotationsMap();
	const results = ids.filter(id => {
		if (!all[id]) { console.warn(missing(id)); return false; }
		if (!validate(all[id][0])) { console.warn(invalid(id)); return false; }
		return true;
	});

	if (!ids.length || results.length) {
		cb(results);
	}
	// tslint:enable
}

function sortAnnotations(ids: string[]) {
	const displayOrder: {[id: string]: number} = mapReduce(CorpusStore.get.allAnnotations(), 'id', (a, i) => i);
	return ids.concat().sort((x, y) => displayOrder[x] - displayOrder[y]);
}

/** Validate all ids, triggering callbacks for failed ids, and triggering a final callback if there is any valid annotation. */
function validateMetadata(
	ids: string[],
	missing: (id: string) => string,
	validate: (m: AppTypes.NormalizedMetadataField) => boolean,
	invalid: (id: string) => string,
	cb: (ids: string[]) => void
) {
	// tslint:disable
	const all = CorpusStore.get.allMetadataFieldsMap();
	const results = ids.filter(id => {
		if (!all[id]) { console.warn(missing(id)); return false; }
		if (!validate(all[id])) { console.warn(invalid(id)); return false; }
		return true;
	});
	if (!ids.length || results.length) {
		cb(results);
	}
	// tslint:enable
}

function sortMetadata(ids: string[]) {
	// use +1 so we can replace undefined results with max_int
	const displayOrder: {[id: string]: number} = mapReduce(CorpusStore.get.allMetadataFields(), 'id', (a, i) => i+1);
	return ids.concat().sort((x, y) => (displayOrder[x] || Number.MAX_SAFE_INTEGER) - (displayOrder[y] || Number.MAX_SAFE_INTEGER));
}

// =============

function gatherchecks(config: MapOf<string[]>, entries: Array<{id: string, groupId?: string}>, defaultGroupName: string) {
	const entryMap = mapReduce(entries, 'id', entry => ({
		id: entry.id,
		groupId: entry.groupId || defaultGroupName,
		checkmarks: {} as MapOf<boolean>
	}));

	Object.entries(config).forEach(([checkmarkName, checkmarkPath]) => {
		const entriesToPutCheck: string[] = checkmarkPath.reduce((context, path) => (context as any)[path], getState()) || [];
		entriesToPutCheck.forEach(id => entryMap[id].checkmarks[checkmarkName] = true);
	});

	// take care to preserve field order
	return entries.map(e => entryMap[e.id]);
}

function getAsGroups(groupOrder: string[], entries: Array<{id: string, groupId: string, checkmarks: MapOf<boolean>}>) {
	return Object.entries(multimapReduce(Object.values(entries), 'groupId'))
	.map(([groupId, values]) => ({groupId, values}))
	.sort((a, b) => groupOrder.indexOf(a.groupId) - groupOrder.indexOf(b.groupId));
}

function getCells(props: string[]) {
	return props.map(p => ({
		propName: p,
		header: `    '${p}'    `,
		checked: ' '.repeat(5 + Math.ceil(p.length / 2)-1) + 'x' + ' '.repeat(5 + Math.floor(p.length / 2)),
		unchecked: ' '.repeat(10 + p.length)
	}));
}

function printCustomizations() {
	// Annotations
	const defaultGroupName = '(not in any group)';

	const annotGroupOrder = CorpusStore.getState().annotationGroups.map(g => g.name).concat(defaultGroupName);
	const metadataGroupOrder = CorpusStore.getState().metadataFieldGroups.map(g => g.name).concat(defaultGroupName);
	const annotColumns = actions.helpers.configureAnnotations.config;
	const metadataColumns = actions.helpers.configureMetadata.config;

	// output stuff
	const annotationData = getAsGroups(annotGroupOrder, gatherchecks(annotColumns, CorpusStore.get.allAnnotations(), defaultGroupName));
	const metadataData = getAsGroups(metadataGroupOrder, gatherchecks(metadataColumns, CorpusStore.get.allMetadataFields(), defaultGroupName));
	const annotationCells = getCells(Object.keys(annotColumns));
	const metadataCells = getCells(Object.keys(metadataColumns));
	const longestAnnotId = annotationData.flatMap(g => g.values).reduce((longest, cur) => Math.max(longest, cur.id.length), 0);
	const longestMetadataId = metadataData.flatMap(g => g.values).reduce((longest, cur) => Math.max(longest, cur.id.length), 0);

	// Sort entries in the default groups by ID (instead of their original sorting by displayName) - Reads much better in output
	(annotationData.find(g => g.groupId === defaultGroupName) || {values: [] as Array<{id: string}>}).values.sort((a, b) => a.id.localeCompare(b.id));
	(metadataData.find(g => g.groupId === defaultGroupName) || {values: [] as Array<{id: string}>}).values.sort((a, b) => a.id.localeCompare(b.id));

	// tslint:disable-next-line
	console.log(html`
		var x = true;
		var ui = vuexModules.ui.actions;
		ui.helpers.configureAnnotations([
			[${' '.repeat(longestAnnotId+2)},${annotationCells.map(c => c.header).join(',')}],
			${annotationData.flatMap(g => [
				'',
				`// ${g.groupId}`,
				...g.values.map(v => stripIndent`
					['${v.id}'${' '.repeat(longestAnnotId - v.id.length)},${annotationCells.map(c => v.checkmarks[c.propName] ? c.checked : c.unchecked).join(',')}],
				`)
			])}
		]);

		ui.helpers.configureMetadata([
			[${' '.repeat(longestMetadataId+2)},${metadataCells.map(c => c.header).join(',')}],
			${metadataData.flatMap(g => [
				'',
				`// ${g.groupId}`,
				...g.values.map(v => stripIndent`
					['${v.id}'${' '.repeat(longestMetadataId - v.id.length)},${metadataCells.map(c => v.checkmarks[c.propName] ? c.checked : c.unchecked).join(',')}],
				`)
			])}
		]);
	`);
}

(window as any).printCustomJs = printCustomizations;

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
