/**
 * This module contains the currently active query.
 * It's updated whenever the user actually submits a query by pressing search/submit on the main form or any of the explore forms.
 * It's essentially a snapshot of the filters and pattern as they were when the form was submitted.
 *
 * It doesn't only store the pattern and filters though,
 * it also contains some information about what part of the search/explore form the query was submitted from.
 * This is so that we can in turn store this in the query history and url,
 * and in turn restore the way the form looks when the user loads an old query through one of those mechanisms.
 *
 * If we were to only store the blacklab query parameters, we don't know whether the
 * query was generated in, for example, the n-gram editor or the querybuilder.
 * (It's very possible to create the same query through both those mechanisms and more).
 *
 * Generally, this part of the state ends up in the query history,
 * and the less processing we do here (such as turning annotations in a normal cql query string, or turning filters into a normal lucene query string)
 * the less work we have to do to undo this when the user loads that same history entry later.
 *
 * In order to generate a complete blacklab query, it is combined with the global settings (page size, sampling, context size, etc)
 * and the results settings (the grouping, viewed page number, etc).
 */

import cloneDeep from 'clone-deep';
import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import { AnnotationValue} from '@/types/apptypes';
import * as CorpusModule from '@/store/search/corpus';
import * as PatternModule from '@/store/search/form/patterns';
import * as FilterModule from '@/store/search/form/filters';
import * as ExploreModule from '@/store/search/form/explore';
import * as GapModule from '@/store/search/form/gap';
import { getPatternString, escapeRegex } from '@/utils';
import { getFilterSummary, getFilterString } from '@/components/filters/filterValueFunctions';

type ModuleRootStateSearch<K extends keyof PatternModule.ModuleRootState> = {
	form: 'search';
	subForm: K;

	formState: PatternModule.ModuleRootState[K];
	filters: FilterModule.ModuleRootState;
	gap: GapModule.ModuleRootState;
};

type ModuleRootStateExplore<K extends keyof ExploreModule.ModuleRootState> = {
	form: 'explore';
	subForm: K;

	formState: ExploreModule.ModuleRootState[K];
	filters: FilterModule.ModuleRootState;
	gap: GapModule.ModuleRootState;
};

type ModuleRootStateNone = {
	form: null;
	subForm: null;
	formState: null;
	filters: null;
	gap: null;
};

type ModuleRootState = ModuleRootStateNone|ModuleRootStateSearch<keyof PatternModule.ModuleRootState>|ModuleRootStateExplore<keyof ExploreModule.ModuleRootState>;

const initialState: ModuleRootStateNone = {
	form: null,
	subForm: null,
	formState: null,
	filters: null,
	gap: null
};

const namespace = 'query';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, initialState));
const getState = b.state();

function e(t: never) {}

const get = {
	patternString: b.read((state): string|undefined => {
		// Nothing submitted yet? This shouldn't be called in that case, but whatever.
		if (!state.form) { return undefined; }

		// Quite a bit of how we generate the cql pattern hinges on which part of the form was submitted.
		if (state.form === 'explore') {
			switch (state.subForm) {
				case 'corpora': return undefined;
				case 'frequency': return '[]';
				case 'ngram': {
					const annots = CorpusModule.get.allAnnotationsMap();
					const stateHelper = state as ModuleRootStateExplore<'ngram'>;

					return stateHelper.formState.tokens
						.slice(0, stateHelper.formState.size)
						// type select because we only ever want to output one cql token per n-gram input
						.map(token => {
							const tokenType = annots[token.id].uiType;
							const correctedType = getCorrectUiType(uiTypeSupport.explore.ngram, tokenType);

							return token.value ? `[${token.id}="${escapeRegex(token.value, correctedType !== 'select').replace(/"/g, '\\"')}"]` : '[]';
						})
						.join('');
				}
				default: throw new Error('Unknown submitted form - cannot generate cql query');
			}
		} else {
			// For the normal search form,
			// the simple and extended views require the values to be processed before converting them to cql.
			// The advanced and expert views already contain a good-to-go cql query. We only need to take care not to emit an empty string.
			switch (state.subForm) {
				case 'simple': {
					const pattern = (state as ModuleRootStateSearch<'simple'>).formState;

					return getPatternString([pattern], null);
				}
				case 'extended': {
					const pattern = (state as ModuleRootStateSearch<'extended'>).formState;
					const annotations: AnnotationValue[] = cloneDeep(Object.values(pattern.annotationValues).filter(annot => !!annot.value))
					.map(annot => ({
						...annot,
						type: getCorrectUiType(uiTypeSupport.search.extended, annot.type!)
					}));
					if (annotations.length === 0) { return undefined; }
					return getPatternString(annotations, pattern.within);
				}
				case 'advanced':
				case 'expert': {
					const pattern = (state as ModuleRootStateSearch<'expert'>).formState;
					// trim leading/trailing whitespace, remove pattern if naught but whitespace
					return (pattern || '').trim() || undefined;
				} 
                                case 'concept': {
                                    return '[word="de"]'
                                }
				default: throw new Error('Unimplemented pattern generation.');
			}
		}
	}, 'patternString'),
	filterString: b.read((state): string|undefined => {
		if (!state.form) { return undefined; }
		return getFilterString(Object.values(state.filters).sort((a, b) => a.id.localeCompare(b.id)));
	}, 'filterString'),
	filterSummary: b.read((state): string|undefined => {
		if (!state.form) { return undefined; }
		return getFilterSummary(Object.values(state.filters).sort((a, b) => a.id.localeCompare(b.id)));
	}, 'filterSummary')
};

const actions = {
	// Deep copy these to prevent aliasing and the reactivity issues that come with it
	// such as writing to current state causing updates in history entries
	search: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'search'),

	reset: b.commit(state => Object.assign(state, Object.assign({}, initialState)), 'reset'),
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

type UITypeArray = Array<CorpusModule.NormalizedAnnotation['uiType']>;
// type ValueType = UITypeArray|{[key: string]: ValueType};

export const uiTypeSupport: {[key: string]: {[key: string]: UITypeArray}} = {
	search: {
		simple: ['combobox', 'select', 'lexicon'],
		extended: ['combobox', 'select', 'pos'],
	},
	explore: {
		ngram: ['combobox', 'select']
	}
};

export function getCorrectUiType<T extends CorpusModule.NormalizedAnnotation['uiType']>(allowed: T[], actual: T): T {
	return allowed.includes(actual) ? actual : 'text' as any;
}

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
