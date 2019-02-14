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

	/** When the form is submitted this is copied to the DocsStore */
	corpora: {
		groupBy: string;
		groupDisplayMode: string;
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
	},

	corpora: {
		groupBy: '',
		groupDisplayMode: ''
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
	},

	corpora: {
		groupBy: b.read(state => state.corpora.groupBy, 'corpora_groupBy'),
		groupDisplayMode: b.read(state => state.corpora.groupDisplayMode, 'corpora_groupDisplayMode'),
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

	corpora: {
		groupBy: b.commit((state, payload: string) => state.corpora.groupBy = payload, 'corpora_groupBy'),
		groupDisplayMode: b.commit((state, payload: string) => state.corpora.groupDisplayMode = payload, 'corpora_groupDisplayMode'),

		reset: b.commit(state => Object.assign(state.corpora, defaults.corpora), 'corpora_reset'),
		replace: b.commit((state, payload: ModuleRootState['corpora']) => Object.assign(state.corpora, payload), 'corpora_replace'),
	},

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.frequency.replace(payload.frequency);
		actions.ngram.replace(payload.ngram);
	}, 'replace'),
	reset: b.commit(state => Object.assign(state, JSON.parse(JSON.stringify(defaults))), 'reset'),
};

const init = () => {
	const {id: firstMainAnnotationId} = CorpusStore.get.firstMainAnnotation();
	defaults.ngram.groupAnnotationId = firstMainAnnotationId;
	while (defaults.ngram.tokens.length < defaults.ngram.maxSize) {
		defaults.ngram.tokens.push({
			id: firstMainAnnotationId,
			value: '',
		});
	}
	actions.ngram.reset();

	const {metadataFieldGroups, metadataFields, fieldInfo} = CorpusStore.getState();
	// const metadataFields = CorpusStore.getState().metadataFields;
	// const specialFields = CorpusStore.getState().fieldInfo;
	const firstSpecialField = [
		fieldInfo.dateField,
		fieldInfo.authorField,
		fieldInfo.titleField,
		fieldInfo.pidField,
		...metadataFieldGroups.flatMap(g => g.fields)
	].find(id => id != null && metadataFields[id] && metadataFields[id].groupId != null);

	const defaultGroupBy = firstSpecialField ? `field:${firstSpecialField}` : '';
	defaults.corpora.groupBy = defaultGroupBy;
	defaults.corpora.groupDisplayMode = 'table';
	actions.corpora.reset();

	defaults.frequency.annotationId = firstMainAnnotationId;
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
