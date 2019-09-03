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
import { mapReduce, MapOf } from '@/utils';
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
		advanced: {
			/** Annotation selection options in querybuilder. Sorted by global annotation order. */
			searchAnnotationIds: string[];
			defaultSearchAnnotationId: string;
		};
		expert: {};
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
		advanced: {
			searchAnnotationIds: [],
			defaultSearchAnnotationId: ''
		},
		expert: {}
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

// =======================
// Some helpers
// =======================

function createConfigurator<T extends MapOf<string[]>>(proppaths: T) {
	return function(config: [[undefined, ...Array<keyof T>],  [string, ...Array<boolean|undefined>]]) {
		const props = config.shift() as string[];
		const propvalues = {} as {[K in keyof T]: string[]};
		Object.keys(proppaths).forEach(function(propname) { propvalues[propname] = []; });

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
}

/** Validate all ids, triggering callbacks for failed ids, and returning a promise that resolves if any id passes. */
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

	results.length && cb(results);
	// tslint:enable
}

function sortAnnotations(ids: string[]) {
	const displayOrder: {[id: string]: number} = mapReduce(CorpusStore.get.allAnnotations(), 'id', (a, i) => i);
	return ids.concat().sort((a, b) => displayOrder[a] - displayOrder[b]);
}

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

	results.length && cb(results);
	// tslint:enable
}

function sortMetadata(ids: string[]) {
	const displayOrder: {[id: string]: number} = mapReduce(CorpusStore.get.allMetadataFields(), 'id', (a, i) => i);
	return ids.concat().sort((a, b) => displayOrder[a] - displayOrder[b]);
}

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
			}, 'search_advanced_defaultSearchAnnotationId')
		},
		expert: {},
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
				id => `Trying to display Annotation '${id}' in hits table, but it does not exist`,
				_ => true, _ => '',
				r => state.results.hits.shownAnnotationIds = r
			), 'hits_shownAnnotationIds'),

			shownMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
					id => `Trying to display metadata field '${id}' in hits table, but it does not exist`,
					_ => true, _ => '',
					r => state.results.hits.shownMetadataIds = r
			), 'hits_shownMetadataIds')
		},
		docs: {
			shownMetadataIds: b.commit((state, ids: string[]) => validateMetadata(ids,
				id => `Trying to display metadata field '${id}' in docs table, but it does not exist`,
				_ => true, _ => '',
				r => state.results.docs.shownMetadataIds = r
			), 'docs_shownMetadataIds')
		},
		shared: {
			detailedAnnotationIds: b.commit((state, ids: string[]|null) => {
				if (ids != null) {
					validateAnnotations(ids,
						id => `Trying to display Annotation '${id}' in expanded hit rows, but it does not exist`,
						_ => true, _ => '',
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
				id => `Trying to allow grouping by Annotation '${id}', which does not have a forward index (a forward index is required for grouping)`,
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
				id => `Trying to allow sorting by Annotation '${id}', which does not have a forward index (a forward index is required for grouping)`,
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
		}
	},
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),

	helpers: {
		/**
		 * Configure many annotations at the same time. Columns without any "true" values are left at their defaults.
		 * Call as follows:
		 * ```js
		 * configureAnnotations([
		 *     [        , 'SORT' , 'GROUP' , 'EXPLORE' , 'RESULTS' , 'CONCORDANCE'],
		 *     ['word'  , true   , true    ,           ,           ,      true    ],
		 *     ['lemma' , true   ,         ,           ,           ,      true    ],
		 *     ...
		 * ]);
		 * ```
		 */
		configureAnnotations: createConfigurator({
			'SORT':        ['results', 'shared', 'sortAnnotationIds'],
			'GROUP':       ['results', 'shared', 'groupAnnotationIds'],
			'EXPLORE':     ['explore', 'searchAnnotationIds'],
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

	const mainAnnotation = CorpusStore.get.firstMainAnnotation().id;

	// Show all annotations & metadata in groups (groups are defined by the user)
	// Exclude annotations without forward index.
	// Also take care to preserve the order of fields
	// Do this first as we use these lists later
	if (!initialState.results.shared.groupAnnotationIds.length) {
		actions.results.shared.groupAnnotationIds(allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id));
	}
	if (!initialState.results.shared.groupMetadataIds.length) {
		actions.results.shared.groupMetadataIds(allShownMetadataFields.map(f => f.id));
	}

	if (!initialState.search.advanced.searchAnnotationIds.length) {
		actions.search.advanced.searchAnnotationIds(allShownAnnotations.map(a => a.id));
	}
	if (!initialState.search.advanced.defaultSearchAnnotationId) {
		actions.search.advanced.defaultSearchAnnotationId(initialState.search.advanced.searchAnnotationIds.includes(mainAnnotation) ? mainAnnotation : (initialState.search.advanced.searchAnnotationIds[0] || ''));
	}
	if (!initialState.explore.searchAnnotationIds.length) {
		actions.explore.searchAnnotationIds(allShownAnnotations.map(a => a.id));
	}
	if (!initialState.explore.defaultSearchAnnotationId) {
		actions.explore.defaultSearchAnnotationId(initialState.explore.searchAnnotationIds.includes(mainAnnotation) ? mainAnnotation : (initialState.explore.searchAnnotationIds[0] || ''));
	}

	if (!initialState.explore.defaultGroupAnnotationId) {
		actions.explore.defaultGroupAnnotationId(initialState.results.shared.groupAnnotationIds.includes(mainAnnotation) ? mainAnnotation : (initialState.results.shared.groupAnnotationIds[0] || ''));
	}
	if (!initialState.explore.defaultGroupMetadataId) {
		actions.explore.defaultGroupMetadataId(initialState.results.shared.groupMetadataIds[0] || '');
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
		actions.results.hits.shownAnnotationIds(shownAnnotations);
	}

	if (!initialState.results.docs.shownMetadataIds.length) {
		const dateField = CorpusStore.getState().fieldInfo.dateField;
		if (dateField) {
			actions.results.docs.shownMetadataIds([dateField]);
		}
	}

	if (!initialState.search.extended.within.elements.length) {
		// explicitly retrieve this annotations as it's supposed to be internal and thus not included in any getters.
		const fields = allAnnotationsMap.starttag;
		const annot = fields ? fields[0] : undefined;
		const validValues = cloneDeep(annot && annot.values ? annot.values : []);
		validValues.forEach(v => {
			if (!v.label.trim()) {
				if (v.value === 'p') { v.label = 'paragraph'; }
				else if (v.value === 's') { v.label = 'sentence'; }
				else if (!v.value) { v.label = 'document'; }
				else { v.label = v.value; }
			}
		});

		if (validValues.length) {
			if (validValues.length <= 6) { // an arbitrary limit
				actions.search.extended.within.elements(cloneDeep(validValues));
			} else {
				console.warn(`Within clause can contain ${validValues.length} different values, ignoring...`);
			}
		} else {
			console.warn('Within clause not supported in this corpus, no starttags indexed');
			actions.search.extended.within.enable(false);
		}
	}

	if (!initialState.results.shared.sortAnnotationIds.length) {
		actions.results.shared.sortAnnotationIds(allShownAnnotations.filter(a => a.hasForwardIndex).map(a => a.id));
	}
	if (!initialState.results.shared.sortMetadataIds.length) {
		actions.results.shared.sortMetadataIds(allShownMetadataFields.map(f => f.id));
	}

	Object.assign(initialState, cloneDeep(getState()));
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
