/**
 * This module contains the corpus info as it's configured in blacklab.
 * We use it for pretty much everything to do with layout:
 * which annotations and filters are available, what is the default annotation (lemma/pos/word/etc...),
 * are the filters subdivided in groups, what is the text direction, and so on.
 */

import Axios from 'axios';
import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';

import {Tagset} from '@/types/apptypes';
import {NormalizedAnnotation} from '@/types/apptypes';
import { mapReduce } from '@/utils';
import cloneDeep from 'clone-deep';

type ModuleRootState = Tagset&{
	/** Uninitialized before init() or load() action called. loading/loaded during/after load() called. Disabled when load() not called before init(), or loading failed for any reason. */
	state: 'uninitialized'|'loading'|'loaded'|'disabled';
	message: string;
};

const namespace = 'tagset';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, {
	state: 'uninitialized',
	message: '',
	subAnnotations: {},
	values: {}
});

const getState = b.state();

const get = {
	isLoaded: b.read(state => state.state === 'loaded', 'tagset_loaded'),
	isLoading: b.read(state => state.state === 'loading', 'tagset_loading'),
};

const internalActions = {
	state: b.commit((state, payload: {state: ModuleRootState['state'], message: string}) => Object.assign(state, payload), 'state'),
	replace: b.commit((state, payload: Tagset) => {
		const annot = CorpusStore.get.annotations().find(a => a.uiType === 'pos');
		if (annot == null) {
			throw new Error(`Tagset isn't attached to any annotation! Set uiType to 'pos' on a single annotation to enable.`);
		}

		validateTagset(annot, payload); // throws if invalid.
		Object.assign(state, payload);
	}, 'replace')
};

// TODO dirty global state :(
let initPromise: Promise<void>;

const actions = {
	/** Load the tagset from the provided url. This should be called prior to decoding the page url. */
	load: b.dispatch((context, url: string) => {
		if (context.state.state !== 'uninitialized') {
			throw new Error('Cannot load tagset after calling store.init(), and cannot replace existing tagset.');
		}

		internalActions.state({state: 'loading', message: 'Loading tagset...'});
		initPromise = Axios.get<Tagset>(url, {
			transformResponse: [(r: string) => r.replace(/\/\/.*[\r\n]+/g, '')].concat(Axios.defaults.transformResponse!)
		})
		.then(t => {
			const tagset = t.data;

			const annots = CorpusStore.get.annotationsMap();
			const posAnnotation = Object.values(annots).flat().find(a => a.uiType === 'pos'); // I mean, has to exist right
			if (!posAnnotation) {
				return;
			}

			const caseSensitive = posAnnotation.caseSensitive;
			if (!caseSensitive) {
				tagset.values = mapReduce(Object.values(tagset.values).map<Tagset['values'][string]>(v => ({
					value: v.value.toLowerCase(),
					displayName: v.displayName,
					subAnnotationIds: v.subAnnotationIds
				})), 'value');
			}

			Object.values(tagset.subAnnotations).forEach(subAnnotInTagset => {
				const actualAnnot = annots[subAnnotInTagset.id][0];
				const subAnnotCaseSensitive = actualAnnot.caseSensitive;

				if (!subAnnotCaseSensitive) {
					subAnnotInTagset.values = subAnnotInTagset.values.map(v => ({
						value: v.value.toLowerCase(),
						displayName: v.displayName,
						pos: v.pos
					}));
				}
			});

			internalActions.replace(t.data);
			internalActions.state({state: 'loaded', message: 'Tagset succesfully loaded'});

			// Apply top-level displaynames to the 'pos' annotation
			Object.values(annots)
			.flat()
			.filter(a => a.uiType === 'pos')
			.forEach(originalAnnotation => {
				const originalValues = mapReduce(originalAnnotation.values, 'value');

				debugger;
				for (const tagsetValue of Object.values(t.data.values)) {
					const a = originalValues[tagsetValue.value];
					const b = tagsetValue;

					const value = a ? a.value : b.value;
					const label = b.displayName || b.value;
					const title = a ? a.title : null;

					originalValues[value] = {
						value,
						label,
						title
					};
				}

				originalAnnotation.values = Object.values(originalValues)
				.sort((a, b) =>
					originalAnnotation.values ?
						originalAnnotation.values.findIndex(v => v.value === a.value) -
						originalAnnotation.values.findIndex(v => v.value === b.value) :
					0
				);
			});

			// apply subannotaton displaynames
			Object.values(t.data.subAnnotations)
			.forEach(subAnnot => {
				annots[subAnnot.id].forEach(originalAnnotation => {
					const originalValues = mapReduce(originalAnnotation.values, 'value');

					for (const tagsetValue of subAnnot.values) {
						const a = originalValues[tagsetValue.value];
						const b = tagsetValue;

						const value = a ? a.value : b.value;
						const label = b.displayName || b.value;
						const title = a ? a.title : null;

						originalValues[value] = {
							value,
							label,
							title
						};
					}

					originalAnnotation.values = Object.values(originalValues)
					.sort((a, b) =>
						originalAnnotation.values ?
							originalAnnotation.values.findIndex(v => v.value === a.value) -
							originalAnnotation.values.findIndex(v => v.value === b.value) :
						0
					);
				});
			});
		})
		.catch(e => {
			// tslint:disable-next-line
			console.warn('Could not load tagset: ' + e.message);
			internalActions.state({state: 'disabled', message: 'Error loading tagset: ' + e.message});
		});
	}, 'load'),

	/**
	 * Closes the loading window, if load() hasn't been called yet, disabled the module permanently and
	 * returns a resolved promise.
	 * If load has been called, returns a promise that resolves when the loading is completed.
	 */
	awaitInit: () => {
		if (initPromise == null) {
			init();
			initPromise = Promise.resolve();
		}
		return initPromise;
	}
};

const init = () => {
	// At this point the global store is being initialized and the url has been parsed, prevent a tagset from loading now (initialization order is pretty strict).
	if (getState().state === 'uninitialized') {
		internalActions.state({state: 'disabled', message: 'No tagset loaded.\n Call "vuexModules.tagset.actions.load(CONTEXT_URL + /static/${path_to_tagset.json}) from custom js file before $document.ready()'});
		initPromise = Promise.resolve();
	}
};

/** check if all annotations and their values exist */
function validateTagset(annotation: NormalizedAnnotation, t: Tagset) {
	const validAnnotations = CorpusStore.get.annotations().reduce((acc, a) => {
		acc[a.id] = a;
		return acc;
	}, {} as {[id: string]: NormalizedAnnotation});

	function validateAnnotation(id: string, values: Tagset['subAnnotations'][string]['values']) {
		const mainAnnotation = validAnnotations[id];
		if (!mainAnnotation) {
			throw new Error(`Annotation "${id}" does not exist in corpus.`);
		}

		if (!mainAnnotation.values) {
			throw new Error(`Annotation "${id}" does not have any known values.`);
		}

		// part-of-speech is almost always indexed case-insensitive
		// so we always want to compare values in the tagset and values in the corpus in lowercase
		const annotationValuesInCorpus = mapReduce(mainAnnotation.values, 'value');
		values.forEach(v => {
			if (!annotationValuesInCorpus[mainAnnotation.caseSensitive ? v.value : v.value.toLowerCase()]) {
				// tslint:disable-next-line
				console.warn(`Annotation "${id}" may have value "${v.value}" which does not exist in the corpus.`);
			}

			if (v.pos) {
				const unknownPosList = v.pos!.filter(pos => !t.values[pos]);
				if (unknownPosList.length > 0) {
					// tslint:disable-next-line
					console.warn(`SubAnnotation '${id}' value '${v.value}' declares unknown main-pos value(s): ${unknownPosList.toString()}`);
				}
			}
		});
	}

	validateAnnotation(annotation.id, Object.values(t.values));
	Object.values(t.subAnnotations).forEach(sub => {
		validateAnnotation(sub.id, sub.values);
	});

	Object.values(t.values).forEach(({value, subAnnotationIds}) => {
		const subAnnotsNotInTagset = subAnnotationIds.filter(id => t.subAnnotations[id] == null);
		if (subAnnotsNotInTagset.length) {
			throw new Error(`Value "${value}" declares subAnnotation(s) "${subAnnotsNotInTagset}" that do not exist in the tagset.`);
		}

		const subAnnotsNotInCorpus = subAnnotationIds.filter(subId => validAnnotations[subId] == null);
		if (subAnnotsNotInCorpus.length) {
			throw new Error(`Value "${value}" declares subAnnotation(s) "${subAnnotsNotInCorpus}" that do not exist in the corpus.`);
		}
	});
}

export {
	ModuleRootState,
	Tagset,

	getState,
	get,
	actions,
	init,

	namespace,
};
