/**
 * Contains the current ui state for the simple/extended/advanced/expert query editors.
 * When the user actually executes the query a snapshot of the state is copied to the query module.
 */

import Vue from 'vue';
import { getStoreBuilder } from 'vuex-typex';
import cloneDeep from 'clone-deep';

import { RootState } from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';

import { debugLog, debugLogCat } from '@/utils/debug';

import { AnnotationValue } from '@/types/apptypes';

type ModuleRootState = {
	// Parallel versions (shared between multiple states, e.g. simple, extended, etc.)
	parallelVersions: {
		source: string|null,
		targets: string[],
	},
	simple: {
		annotationValue: AnnotationValue
	},
	extended: {
		annotationValues: {
			// [annotatedFieldId: string]: {
				[annotationId: string]: AnnotationValue
			// }
		},
		within: string|null,
		splitBatch: boolean,
	},
	advanced: {
		query: string|null,
		targetQueries: string[],
	},
	expert: {
		query: string|null,
		targetQueries: string[],
	},
	concept: string|null, // Jesse
	glosses: string|null, // Jesse
};

// There are three levels of state initialization
// First: the basic state shape (this)
// Then: the basic state shape with the appropriate annotation and filters created
// Finally: the values initialized from the page's url on first load.
const defaults: ModuleRootState = {
	parallelVersions: {
		source: null,
		targets: [],
	},
	simple: {
		annotationValue: {case: false, id: '', value: '', type: 'text'}
	},
	extended: {
		annotationValues: {},
		within: null,
		splitBatch: false,
	},
	advanced: {
		query: null,
		targetQueries: [],
	},
	expert: {
		query: null,
		targetQueries: [],
	},
	concept: null,
	glosses: null,
};

const namespace = 'patterns';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(defaults));

const getState = b.state();

const get = {
	/** Last submitted properties, these are already filtered to remove empty values, etc */
	activeAnnotations: b.read(state => Object.values(state.extended.annotationValues)/*.flatMap(f => Object.values(f))*/.filter(p => !!p.value), 'activeAnnotations'),

	/** Get the annotation's search value in the extended form */
	annotationValue(annotatedFieldId: string, id: string) {
		return getState().extended.annotationValues/*[annotatedFieldId]*/[id];
	},

	simple: b.read(state => state.simple, 'simple'),

	/** Selected parallel source and target versions */
	parallelVersions: b.read(state => state.parallelVersions, 'parallelVersions'),

	/** What parallel versions should be shown as source options?
	 *  (all except already chosen target ones)
	 */
	parallelSourceVersionOptions: b.read((state: ModuleRootState): { value: string, label: string }[] => {
		const targets = state.parallelVersions.targets;
		return CorpusStore.get.parallelVersionOptions().filter(value => !targets.includes(value.value));
	}, 'parallelSourceVersionOptions'),

	/** What parallel versions should be shown as target options?
	 *  (all except already chosen source one; the widget will also filter out already chosen target ones, so we
	 *  shouldn't do that here)
	 */
	parallelTargetVersionOptions: b.read((state: ModuleRootState): { value: string, label: string }[] => {
		const src = state.parallelVersions.source || '';
		const targets = state.parallelVersions.targets || [];
		return CorpusStore.get.parallelVersionOptions().filter(value => value.value !== src);
	}, 'parallelTargetVersionOptions'),
};

const privateActions = {
	// initFilter: b.commit((state, payload: FilterValue) => Vue.set(state.filters, payload.id, payload), 'filter_init'),
	// NOTE when re-integrating annotatedFieldId this needs to be updated to account.
	initExtendedAnnotation: b.commit((state, payload: AnnotationValue) =>
			Vue.set(state.extended.annotationValues, payload.id, payload), 'annotation_init_extended'),
	initSimpleAnnotation: b.commit((state, payload: ModuleRootState['simple']) => Object.assign<ModuleRootState['simple'],
			ModuleRootState['simple']>(state.simple, payload), 'annotation_init_simple'),
	initParallelVersions: b.commit((state, payload: ModuleRootState['parallelVersions']) => Object.assign<ModuleRootState['parallelVersions'],
			ModuleRootState['parallelVersions']>(state.parallelVersions, payload), 'parallelVersions_init'),
};

const setTargetVersions = (state: ModuleRootState, payload: string[]|null) => {
	debugLogCat('parallel', `parallelVersions.parallelTargetVersions: Setting to ${payload}`);
	if (payload && payload.length > 0) {
		while (state.advanced.targetQueries.length < payload.length) {
			state.advanced.targetQueries.push('');
		}
		while (state.expert.targetQueries.length < payload.length) {
			state.expert.targetQueries.push('');
		}
	}
	return Vue.set(state.parallelVersions, 'targets', payload);
};

const actions = {
	parallelVersions: {
		sourceVersion: b.commit((state, payload: string|null) => {
			debugLogCat('parallel', `parallelVersions.source: Setting to ${payload}`);
			return (state.parallelVersions.source = payload);
		}, 'parallelVersions_source_version'),
		addTarget: b.commit((state, version: string) => {
			debugLogCat('parallel', `parallelVersions.addTargetVersion: Adding ${version}`);
			if (!version) {
				console.warn('tried to add null target version');
				return;
			}
			const payload = state.parallelVersions.targets.concat([version]);
			return setTargetVersions(state, payload);
		}, 'parallelVersions_addTarget'),
		removeTarget: b.commit((state, version: string) => {
			debugLogCat('parallel', `parallelVersions.removeTargetVersion: Removing ${version}`);
			const payload = state.parallelVersions.targets.filter(v => v !== version);
			return setTargetVersions(state, payload);
		}, 'parallelVersions_removeTarget'),
		targetVersions: b.commit(setTargetVersions, 'parallelVersions_targets'),
		reset: b.commit(state => {
			const defaultSourceVersion = CorpusStore.get.parallelVersions()[0]?.name;
			debugLogCat('parallel', `parallelVersions.reset: Selecting default source version ${defaultSourceVersion}`);
			state.parallelVersions.source = defaultSourceVersion;
			state.parallelVersions.targets = [];
		}, 'parallelVersions_reset'),
	},
	simple: {
		annotation: b.commit((state, {id, type, ...safeValues}: Partial<AnnotationValue>&{id: string}) => {
			// Never overwrite annotatedFieldId or type, even when they're submitted through here.
			Object.assign(state.simple.annotationValue, safeValues);
		}, 'simple_annotation'),
		reset: b.commit(state => {
			state.simple.annotationValue.value = '';
			state.simple.annotationValue.case = false;
		}, 'simple_reset'),
	},
	extended: {
		annotation: b.commit((state, {id, type, ...safeValues}: Partial<AnnotationValue>&{id: string}) => {
			// Never overwrite annotatedFieldId or type, even when they're submitted through here.
			Object.assign(state.extended.annotationValues[id], safeValues);
		}, 'extended_annotation'),
		within: b.commit((state, payload: string|null) => state.extended.within = payload, 'extended_within'),
		splitBatch: b.commit((state, payload: boolean) => state.extended.splitBatch = payload, 'extended_split_batch'),
		reset: b.commit(state => {
			Object.values(state.extended.annotationValues).forEach(annot => {
				annot.value = '';
				annot.case = false;
			});
			state.extended.within = null;
			state.extended.splitBatch = false;
		}, 'extended_reset'),
	},
	advanced: {
		query: b.commit((state, payload: string|null) => {
			return (state.advanced.query = payload);
		}, 'advanced_query'),
		targetQueries: b.commit((state, payload: string[]) => {
			return (state.advanced.targetQueries = payload);
		}, 'advanced_target_queries'),
		reset: b.commit(state => {
			state.advanced.query = null
			state.advanced.targetQueries = [];
		}, 'advanced_reset'),
	},
	expert: {
		query: b.commit((state, payload: string|null) => {
			return (state.expert.query = payload);
		}, 'expert_query'),
		targetQueries: b.commit((state, payload: string[]) => {
			return (state.expert.targetQueries = payload);
		}, 'expert_target_queries'),
		reset: b.commit(state => {
			state.expert.query = null;
			state.expert.targetQueries = [];
		}, 'expert_reset'),
	},
	concept: b.commit((state, payload: string|null) =>state.concept = payload, 'concept'),
	glosses: b.commit((state, payload: string|null) =>state.glosses = payload, 'glosses'),

	reset: b.commit(state => {
		actions.simple.reset();
		actions.extended.reset();
		actions.advanced.reset();
		actions.expert.reset();
		state.concept = null;
		state.glosses = null;
	}, 'reset'),

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.parallelVersions.reset();
		actions.parallelVersions.sourceVersion(payload.parallelVersions.source);
		actions.parallelVersions.targetVersions(payload.parallelVersions.targets);

		actions.simple.reset();
		actions.simple.annotation(payload.simple.annotationValue);

		actions.extended.reset();
		actions.extended.within(payload.extended.within);
		state.extended.splitBatch = payload.extended.splitBatch;
		Object.values(payload.extended.annotationValues).forEach(actions.extended.annotation);

		actions.advanced.reset();
		actions.advanced.query(payload.advanced.query);
		actions.advanced.targetQueries(payload.expert.targetQueries);

		actions.expert.reset();
		actions.expert.query(payload.expert.query);
		actions.expert.targetQueries(payload.expert.targetQueries);

		actions.concept(payload.concept);
		actions.glosses(payload.glosses);
	}, 'replace'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {
	const parallelVersions = CorpusStore.get.parallelVersions();
	const defaultParallelVersion = parallelVersions.length === 0 ? '' : parallelVersions[0].name;
	debugLogCat('parallel', `init: Set default parallel version: ${defaultParallelVersion}`);
	privateActions.initParallelVersions({
		source: defaultParallelVersion,
		targets: [],
	})
	CorpusStore.get.allAnnotations().forEach(({id, uiType}) =>
		privateActions.initExtendedAnnotation({
			id,
			value: '',
			case: false,
			type: uiType
		})
	);
	privateActions.initSimpleAnnotation({
		annotationValue: {
			id: CorpusStore.get.firstMainAnnotation().id,
			value: '',
			case: false,
			type: CorpusStore.get.firstMainAnnotation().uiType,
		}
	});
	debugLog('Finished initializing pattern module state shape');
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
	defaults
};
