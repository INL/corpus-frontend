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
 * the more work we have to do to undo this
 * when the user loads that same history entry later.
 *
 * In order to generate a complete blacklab query, it is combined with the global settings (page size, sampling, context size, etc)
 * and the results settings (the grouping, viewed page number, etc).
 */

import {getStoreBuilder} from 'vuex-typex';
import {RootState} from '@/store';

import { AnnotationValue} from '@/types/apptypes';
import * as CorpusModule from '@/store/corpus';
import * as PatternModule from '@/store/form/patterns';
import * as FilterModule from '@/store/form/filters';
import * as ExploreModule from '@/store/form/explore';
import { getFilterString, makeWildcardRegex } from '@/utils';

type ModuleRootStateSearch<K extends keyof PatternModule.ModuleRootState> = {
	form: 'search';
	subForm: K;

	formState: PatternModule.ModuleRootState[K];
	filters: FilterModule.ModuleRootState;
};

type ModuleRootStateExplore<K extends keyof ExploreModule.ModuleRootState> = {
	form: 'explore';
	subForm: K;

	formState: ExploreModule.ModuleRootState[K];
	filters: FilterModule.ModuleRootState;
};

type ModuleRootStateNone = {
	form: null;
	subForm: null;
	formState: null;
	filters: null;
};

type ModuleRootState = ModuleRootStateNone|ModuleRootStateSearch<keyof PatternModule.ModuleRootState>|ModuleRootStateExplore<keyof ExploreModule.ModuleRootState>;

const initialState: ModuleRootStateNone = {
	form: null,
	subForm: null,
	formState: null,
	filters: null
};

const namespace = 'query';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, initialState));
const getState = b.state();

function getCQLFromAnnotations(annotations: AnnotationValue[], within: null|string) {
	// First split the properties into individual words and pair them
	const tokens = [] as Array<{[key: string]: string}>;
	annotations.forEach(({id, case: caseSensitive, value}) => {
		value
		.replace(/"/g, '')
		.trim()
		.split(/\s+/)
		.filter(v => !!v)
		.forEach((word, i) => {
			if (!tokens[i]) {
				tokens[i] = {};
			}

			tokens[i][id] = (caseSensitive ? '(?-i)' : '') + makeWildcardRegex(word);
		});
	});

	const tokenStrings = [] as string[];
	tokens.forEach(token => {
		// push all attributes in this token
		const attributesStrings = [] as string[];
		Object.entries(token).forEach(([key, value]) => {
			if (value) { // don't push empty attributes
				attributesStrings.push(key + '=' + '"' + value + '"');
			}
		});

		tokenStrings.push('[', attributesStrings.join(' & '), ']');
	});

	if (tokenStrings.length > 0 && within) {
		tokenStrings.push(' within ', '<'+within+'/>');
	}

	return tokenStrings.join('') || undefined;
}

const get = {
	patternString: b.read((state): string|undefined => {
		// Nothing submitted yet? This shouldn't be called in that case, but whatever.
		if (!state.form) { return undefined; }

		// Quite a bit of how we generate the cql pattern hinges on which part of the form was submitted.
		if (state.form === 'explore') {
			switch (state.subForm) {
				case 'frequency': {
					// const stateHelper = state as ModuleRootStateExplore<'frequency'>;
					return '[]';
				}
				case 'ngram': {
					const stateHelper = state as ModuleRootStateExplore<'ngram'>;
					return stateHelper.formState.tokens
						.slice(0, stateHelper.formState.size)
						.map(({id, value}) => value ? `[${id}="${makeWildcardRegex(value)}"]` : '[]')
						.join('');
				}
				default: throw new Error('Unknown submitted form ' + state.subForm + ' - cannot generate cql query');
			}
		} else {
			// For the normal search form,
			// the simple and extended views require the values to be processed before converting them to cql.
			// The advanced and expert views already contain a good-to-go cql query. We only need to take care not to emit an empty string.
			switch (state.subForm) {
				case 'simple': {
					const pattern = (state as ModuleRootStateSearch<'simple'>).formState;
					if (!pattern) { return undefined; }
					return getCQLFromAnnotations([{
						annotatedFieldId: CorpusModule.get.firstMainAnnotation().annotatedFieldId,
						case: false,
						id: CorpusModule.get.firstMainAnnotation().id,
						value: pattern,
						type: 'text'
					}], null);
				}
				case 'extended': {
					const pattern = (state as ModuleRootStateSearch<'extended'>).formState;
					const annotations: AnnotationValue[] = Object.values(pattern.annotationValues).filter(annot => !!annot.value);
					if (annotations.length === 0) { return undefined; }
					return getCQLFromAnnotations(annotations, pattern.within);
				}
				case 'advanced':
				case 'expert': {
					const pattern = (state as ModuleRootStateSearch<'expert'>).formState;
					return pattern || undefined;
				}
				default: throw new Error('Unimplemented pattern generation.');
			}
		}
	}, 'patternString'),
	filterString: b.read((state): string|undefined => {
		if (!state.form) { return undefined; }
		return getFilterString(Object.values(state.filters));
	}, 'filterString'),
};

const actions = {
	// Deep copy these to prevent aliasing and the reactivity issues that come with it
	// such as writing to current state causing updates in history entries
	search: b.commit((state, payload: ModuleRootState) => Object.assign(state, JSON.parse(JSON.stringify(payload))), 'search'),

	reset: b.dispatch(state => Object.assign(state, Object.assign({}, initialState)), 'reset'),
	replace: b.dispatch((state, payload: ModuleRootState) => Object.assign(state, JSON.parse(JSON.stringify(payload))), 'replace'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
};
