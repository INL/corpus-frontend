import Vue from 'vue';
import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store';
import * as CorpusStore from '@/store/corpus';

import { HistoryEntry } from '@/store/history';
import { debugLog } from '@/utils/debug';

import { NormalizedIndex, MetadataValue, AnnotationValue } from '@/types/apptypes';

type SubmittedParameters = {
	pattern: null|string|{
		/** Only contains annotations with a value */
		annotations: AnnotationValue[];
		within: string|null;
	};
	/** Only contains filters with a value */
	filters: MetadataValue[];
};

type ModuleRootState = {
	filters: { [key: string]: MetadataValue };

	activePattern: keyof ModuleRootState['pattern'];
	pattern: {
		simple: string|null;
		extended: {
			annotationValues: {
				// [annotatedFieldId: string]: {
					[annotationId: string]: AnnotationValue
				// }
			},
			within: string|null;
		},
		advanced: string|null;
		expert: string|null;
	};

	/** These were the parameters the last time the query was submitted, a somewhat processed version of the rest of the state */
	submittedParameters: SubmittedParameters|null;
};

// There are three levels of state initialization
// First: the basic state shape (this)
// Then: the basic state shape with the appropriate annotation and filters created
// Finally: the values initialized from the page's url on first load.
const initialState: ModuleRootState = {
	filters: {},
	activePattern: 'simple',
	pattern: {
		simple: null,
		extended: {
			annotationValues: {},
			within: null,
		},
		advanced: null,
		expert: null,
	},
	submittedParameters: null,
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('form', initialState);

const getState = b.state();

const get = {
	/** Last submitted properties, these are already filtered to remove empty values, etc */
	lastSubmittedParameters: b.read(state => state.submittedParameters, 'lastSubmittedParameters'),
	activeAnnotations: b.read(state => Object.values(state.pattern.extended.annotationValues)/*.flatMap(f => Object.values(f))*/.filter(p => !!p.value), 'activeAnnotations'),
	activePatternValue: b.read(state => state.activePattern ? state.pattern[state.activePattern] : null, 'activePatternValue'),
	/** Filters do not apply in simple search */
	activeFilters: b.read(state => Object.values(state.filters).filter(f =>  {
		// remove empty strings
		const numValues = f.values.filter(v => !!v).length;
		// Only active when both fields filled for range, or at least a single string for select, or text non-empty
		return f.type === 'range' ? numValues === 2 : numValues > 0;
	}), 'activeFilters'),

	annotationValue(annotatedFieldId: string, id: string) {
		return getState().pattern.extended.annotationValues/*[annotatedFieldId]*/[id];
	},
	metadataValue(id: string) {
		return getState().filters[id];
	}
};

const privateActions = {
	initFilter: b.commit((state, payload: MetadataValue) => Vue.set(state.filters, payload.id, payload), 'filter_init'),
	// NOTE when re-integrating annotatedFieldId this needs to be updated to account.
	initAnnotation: b.commit((state, payload: AnnotationValue) => Vue.set(state.pattern.extended.annotationValues, payload.id, payload), 'annotation_init'),
};

const actions = {
	filter: b.commit((state, {id, values}: {id: string, values: string[]}) => state.filters[id].values = values, 'filter'),
	resetFilters: b.commit(state => Object.values(state.filters).forEach(filter => filter.values = []), 'filter_reset'),

	activePattern: b.commit((state, payload: ModuleRootState['activePattern']) => state.activePattern = payload, 'activePattern'),
	pattern: {
		simple: b.commit((state, payload: string|null) => state.pattern.simple = payload, 'simple'),
		extended: {
			// TODO ignore invalids annotations (can happen when parsing from url)
			annotation: b.commit((state, {id/*, annotatedFieldId*/, ...rest}: Partial<AnnotationValue>&{id: string/*, annotatedFieldId: string*/}) => Object.assign(state.pattern.extended.annotationValues/*[annotatedFieldId]*/[id], rest), 'extended_annotation'),
			within: b.commit((state, payload: string|null) => state.pattern.extended.within = payload, 'extended_within'),
			reset: b.commit(state => {
				Object.values(state.pattern.extended.annotationValues)/*.forEach(field => Object.values(field)*/.forEach(annot => {
					annot.value = '';
					annot.case = false;
				})/*)*/;
				state.pattern.extended.within = null;
			}, 'extended_reset'),
		},
		advanced: b.commit((state, payload: string|null) =>state.pattern.advanced = payload, 'advanced'),
		expert: b.commit((state, payload: string|null) => state.pattern.expert = payload, 'expert')
	},

	search: b.commit(state => {
		// Get the state without the submittedParameters key

		// Deep copy these to prevent aliasing and the reactivity issues that come with it
		// such as writing to current state causing updates in history entries
		// NOTE: filters do not apply in simple search
		const filters = state.activePattern === 'simple' ? [] : JSON.parse(JSON.stringify(get.activeFilters()))  as ReturnType<typeof get['activeFilters']>; // small type safety for if we change one of the two later

		const submitted: ModuleRootState['submittedParameters'] = {
			filters,
			pattern: null
		};

		switch (state.activePattern) {
			case 'advanced':
			case 'expert':
				submitted.pattern = state.pattern[state.activePattern] || null; break;
			case 'simple': {
				// simple search is the same as extended search, except only the main annotation (usually 'word') is shown,
				// and no case-sensitivity or within is supported
				// so we must treat it the same as extended, but with only one active annotation
				// This has the added benefit of making restoring from history simpler, since we don't have to go and unescape the query (into wildcard, pipes, separate tokens etc) when restoring
				// It doesn't matter for the url generation and decoding, but that is a more loose system where the query is parsed on a best-effort basis anyway
				const mainAnnotation = CorpusStore.get.firstMainAnnotation();
				if (state.pattern.simple && state.pattern.simple.trim()) {
					submitted.pattern = {
						annotations: [{
							annotatedFieldId: mainAnnotation.annotatedFieldId,
							case: false,
							id: mainAnnotation.id,
							value: state.pattern.simple
						}],
						within: null
					};
				}
				break;
			}
			case 'extended': {
				const activeAnnotations = get.activeAnnotations();
				if (activeAnnotations.length) {
					submitted.pattern = {
						annotations: JSON.parse(JSON.stringify(activeAnnotations)) as typeof activeAnnotations,
						within: state.pattern.extended.within
					};
				} // else no annotations active, keep submitted.pattern as null.
				break;
			}
		}

		state.submittedParameters = submitted;
	}, 'search'),

	reset: b.commit(state => {
		actions.resetFilters();
		state.pattern.simple = null;
		actions.pattern.extended.reset();
		state.pattern.advanced = null;
		state.pattern.expert = null;
		state.submittedParameters = null;
		// No need to reset activepattern, just reset the values
	}, 'reset'),

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.resetFilters();
		Object.values(payload.filters).forEach(actions.filter);
		actions.pattern.simple(payload.pattern.simple);
		actions.pattern.advanced(payload.pattern.advanced);
		actions.pattern.expert(payload.pattern.expert);
		actions.pattern.extended.reset();
		actions.pattern.extended.within(payload.pattern.extended.within);
		Object.values(payload.pattern.extended.annotationValues)/*.forEach(f => Object.values(f)*/.forEach(actions.pattern.extended.annotation)/*)*/;
		actions.activePattern(payload.activePattern);
		state.submittedParameters = payload.submittedParameters;
	}, 'replace'),
	replaceFromHistory: b.commit((state, {pattern, filters}: HistoryEntry) => {
		actions.reset();
		if (pattern == null) {
			// nothing to do here, everything is reset, default tab is active already
		} else if (typeof pattern === 'string') {
			/**
			 * FIXME we might be restoring a query from the expert view into the advanced view (querybuilder here)
			 * which might fail
			 * reason this happens is that both expert and advanced queries end up
			 * as a string in submittedParameters.pattern when the form is submitted
			 * this string in turn ends up in the history entry we're trying to restore here (the 'pattern' argument here)
			 * but at this point we don't know whether this query is valid (expert allows the user to type one after all, and it might contain errors)
			 * so we try to restore to the querybuilder and it might fail when parsing.
			 *
			 * the same issue exists with simple/extended, but if the config fits into the simple view
			 * (e.g. only has a value for the main annotation, doesn't require case-sensitive matching, and doesn't use 'within')
			 * then it's no big deal to restore to simple view instead of extended view (since this can't fail)
			 *
			 * TODO solution might just be to serialize the querybuilder state as something else than a string, so we can cleanly restore it.
			 * we can of course keep support for parsing direct cql, but it would sidestep this problem in history.
			 */
			actions.pattern.advanced(pattern);
			actions.pattern.expert(pattern);
			actions.activePattern('expert');
		} else {
			const mainAnnotation = CorpusStore.get.firstMainAnnotation();
			if (
				pattern.within == null &&
				pattern.annotations.length === 1 &&
				pattern.annotations[0].id === mainAnnotation.id &&
				pattern.annotations[0].annotatedFieldId === mainAnnotation.annotatedFieldId &&
				pattern.annotations[0].case === false
			) { // alright, it fits into the simple view
				actions.pattern.simple(pattern.annotations[0].value);
				actions.activePattern('simple');
			} else {
				actions.pattern.extended.within(pattern.within);
				pattern.annotations.forEach(actions.pattern.extended.annotation);
				actions.activePattern('extended');
			}
		}

		filters.forEach(actions.filter);
	}, 'replaceFromHistory')
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = (index: NormalizedIndex) => {
	Object.values(index.annotatedFields).forEach(af => {
		Object.values(af.annotations).filter(annot => !annot.isInternal).forEach(a => {
			privateActions.initAnnotation({
				annotatedFieldId: a.annotatedFieldId,
				id: a.id,
				value: '',
				case: false,
			});
		});
	});

	Object.values(index.metadataFields).forEach(m => {
		privateActions.initFilter({
			type: m.uiType,
			id: m.id,
			values:
				m.uiType === 'select' ? [] :
				m.uiType === 'combobox' ? [] :
				m.uiType === 'range' ? ['',''] :
				m.uiType === 'checkbox' ? [] :
				[''] // normal text, radio
		});
	});

	debugLog('Finished initializing formModule state shape');
};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	SubmittedParameters,
};
