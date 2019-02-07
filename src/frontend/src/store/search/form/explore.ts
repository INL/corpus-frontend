/**
 * Contains the current ui state for n-gram form.
 * When the user actually executes the query a snapshot of the state is copied to the query module.
 */
import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus'; // Is initialized before we are.
import {makeWildcardRegex} from '@/utils';
import {AnnotationValue} from '@/types/apptypes';

type Token = Pick<AnnotationValue, Exclude<keyof AnnotationValue, 'annotatedFieldId'|'case'>>;

type ModuleRootState = {
	ngram: {
		maxSize: number;
		size: number;
		tokens: Token[];
		groupAnnotationId: string;
	};

	frequency: {
		annotationId: string;
	};
};

// NOTE: This state shape is invalid, we correct it on store initialization
const defaults: ModuleRootState = {
	ngram: {
		/** 1-indexed */
		maxSize: 5,
		/** 1-indexed */
		size: 5,
		tokens: [],
		groupAnnotationId: ''
	},

	frequency: {
		annotationId: ''
	}
};

const namespace = 'explore';
const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, JSON.parse(JSON.stringify(defaults)));
const getState = b.state();

const get = {
	ngram: {
		size: b.read(state => state.ngram.size, 'ngram_size'),
		maxSize: b.read(state => state.ngram.maxSize, 'ngram_maxSize'),
		tokens: b.read(state => state.ngram.tokens, 'ngram_tokens'),
		groupAnnotationId: b.read(state => state.ngram.groupAnnotationId, 'ngram_groupAnnotationId'),

		groupBy: b.read(state => `hit:${state.ngram.groupAnnotationId}`, 'ngram_groupBy'),
		patternString: b.read(state => state.ngram.tokens
			.slice(0, state.ngram.size)
			.map(({id, value}) => value ? `[${id}="${makeWildcardRegex(value)}"]` : '[]')
			.join('')
		, 'ngram_patternString')
	},

	frequency: {
		annotationId: b.read(state => state.frequency.annotationId, 'frequency_annotationId'),
		patternString: b.read(() => '[]', 'frequency_patternString'), // always search for all tokens.
		groupBy: b.read(state => `hit:${state.frequency.annotationId}`, 'frequency_groupBy')
	}
};

const internalActions = {
	fixTokenArray: b.commit(state => {
		const {id} = CorpusStore.get.firstMainAnnotation();
		state.ngram.tokens = state.ngram.tokens.slice(0, state.ngram.maxSize);
		while (state.ngram.tokens.length < state.ngram.maxSize) {
			state.ngram.tokens.push({
				id,
				value: '',
			});
		}
	}, 'fixTokenArray')
};

const actions = {
	ngram: {
		size: b.commit((state, payload: number) => state.ngram.size = Math.min(state.ngram.maxSize, payload), 'ngram_size'),
		token: b.commit((state, payload: { index: number, token: Partial<Token> }) => {
			if (payload.index < state.ngram.maxSize) {
				Object.assign(state.ngram.tokens[payload.index], payload.token);
			}
		}, 'ngram_token'),
		groupAnnotationId: b.commit((state, payload: string) => state.ngram.groupAnnotationId = payload, 'ngram_groupAnnotationId'),
		maxSize: b.commit((state, payload: number) => {
			state.ngram.size = Math.min(state.ngram.size, payload);
			state.ngram.tokens = state.ngram.tokens.slice(0, payload);
			internalActions.fixTokenArray();
		}, 'ngram_maxSize'),

		// stringify/parse required so we don't alias the default array
		reset: b.commit(state => Object.assign(state.ngram, JSON.parse(JSON.stringify(defaults.ngram))), 'ngram_reset'),

		replace: b.commit((state, payload: ModuleRootState['ngram']) => {
			Object.assign(state.ngram, payload);
			internalActions.fixTokenArray(); // for when new token array doesn't match maximum length
		}, 'ngram_replace')
	},

	frequency: {
		annotationId: b.commit((state, payload: string) => state.frequency.annotationId = payload, 'frequency_annotationId'),

		reset: b.commit(state => Object.assign(state.frequency, defaults.frequency) , 'frequency_reset'),
		replace: b.commit((state, payload: ModuleRootState['frequency']) => Object.assign(state.frequency, payload), 'frequency_replace'),
	},

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.frequency.replace(payload.frequency);
		actions.ngram.replace(payload.ngram);
	}, 'replace'),
	reset: b.commit(state => Object.assign(state, JSON.parse(JSON.stringify(defaults))), 'reset'),
};

const init = () => {
	const {id} = CorpusStore.get.firstMainAnnotation();
	defaults.ngram.groupAnnotationId = id;
	while (defaults.ngram.tokens.length < defaults.ngram.maxSize) {
		defaults.ngram.tokens.push({
			id,
			value: '',
		});
	}
	actions.ngram.reset();

	defaults.frequency.annotationId = id;
	actions.frequency.reset();
};

export {
	ModuleRootState,
	Token,

	getState,
	get,
	actions,
	init,

	namespace,
	defaults,
};
