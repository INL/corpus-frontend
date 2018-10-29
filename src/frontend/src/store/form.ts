import $ from 'jquery';

import Vue from 'vue';
import { getStoreBuilder } from 'vuex-typex';

import { RootState } from '@/store';
import { getPatternString } from '@/utils';
import { debugLog } from '@/utils/debug';

import { NormalizedIndex, MetadataValue, AnnotationValue } from '@/types/apptypes';

type ModuleRootState = {
	filters: { [key: string]: MetadataValue };

	activePattern: keyof ModuleRootState['pattern'];
	pattern: {
		cql: string|null;
		queryBuilder: string|null;
		simple: {
			annotationValues: {
				// [annotatedFieldId: string]: {
					[annotationId: string]: AnnotationValue
				// }
			},
			within: string|null;
		}
	};

	/** These were the parameters the last time the query was submitted, a somewhat processed version of the rest of the state */
	submittedParameters: null|{
		pattern: null|string;
		/** Only contains filters with a value */
		filters: MetadataValue[];
	}
};

// There are three levels of state initialization
// First: the basic state shape (this)
// Then: the basic state shape with the appropriate annotation and filters created
// Finally: the values initialized from the page's url on first load.
const initialState: ModuleRootState = {
	filters: {},
	activePattern: 'simple',
	pattern: {
		cql: null,
		queryBuilder: null,
		simple: {
			annotationValues: {},
			within: null,
		}
	},
	submittedParameters: null,
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('form', initialState);

const getState = b.state();

const get = {
	/** Last submitted properties, these are already filtered to remove empty values, etc */
	lastSubmittedParameters: b.read(state => state.submittedParameters, 'lastSubmittedParameters'),
	activeAnnotations: b.read(state => Object.values(state.pattern.simple.annotationValues)/*.flatMap(f => Object.values(f))*/.filter(p => !!p.value), 'activeAnnotations'),
	activePatternValue: b.read(state => state.activePattern ? state.pattern[state.activePattern] : null, 'activePatternValue'),
	activeFilters: b.read(state => Object.values(state.filters).filter(f =>  {
		// remove empty strings
		const numValues = f.values.filter(v => !!v).length;
		// Only active when both fields filled for range, or at least a single string for select, or text non-empty
		return f.type === 'range' ? numValues === 2 : numValues > 0;
	}), 'activeFilters'),

	annotationValue(annotatedFieldId: string, id: string) {
		// debugger;
		return getState().pattern.simple.annotationValues/*[annotatedFieldId]*/[id];
	},
	metadataValue(id: string) {
		return getState().filters[id];
	}
};

const privateActions = {
	initFilter: b.commit((state, payload: MetadataValue) => Vue.set(state.filters, payload.id, payload), 'filter_init'),
	// NOTE when re-integrating annotatedFieldId this needs to be updated to account.
	initAnnotation: b.commit((state, payload: AnnotationValue) => Vue.set(state.pattern.simple.annotationValues, payload.id, payload), 'annotation_init'),
};

const actions = {
	filter: b.commit((state, {id, values}: {id: string, values: string[]}) => state.filters[id].values = values, 'filter'),
	resetFilters: b.commit(state => Object.values(state.filters).forEach(filter => filter.values = []), 'filter_reset'),

	activePattern: b.commit((state, payload: ModuleRootState['activePattern']) => state.activePattern = payload, 'activePattern'),
	pattern: {
		simple: {
			// TODO ignore invalids annotations (can happen when parsing from url)
			annotation: b.commit((state, {id/*, annotatedFieldId*/, ...rest}: Partial<AnnotationValue>&{id: string/*, annotatedFieldId: string*/}) => Object.assign(state.pattern.simple.annotationValues/*[annotatedFieldId]*/[id], rest), 'simple_value'),
			within: b.commit((state, payload: string|null) => state.pattern.simple.within = payload, 'simple_within'),
			reset: b.commit(state => {
				Object.values(state.pattern.simple.annotationValues)/*.forEach(field => Object.values(field)*/.forEach(annot => {
					annot.value = '';
					annot.case = false;
				})/*)*/;
				state.pattern.simple.within = null;
			}, 'pattern_simple_reset'),
		},
		queryBuilder: b.commit((state, payload: string|null) =>state.pattern.queryBuilder = payload, 'querybuilder'),
		cql: b.commit((state, payload: string|null) => state.pattern.cql = payload, 'cql')
	},

	search: b.commit(state => {
		// Get the state without the submittedParameters key
		state.submittedParameters = {
			filters: JSON.parse(JSON.stringify(get.activeFilters())) as ReturnType<typeof get['activeFilters']>, // small type safety for if we change one of the two later
			pattern: state.activePattern ? getPatternString(state.pattern[state.activePattern])||null : null,
		};
	}, 'search'),

	reset: b.commit(state => {
		actions.resetFilters();
		actions.pattern.simple.reset();
		state.pattern.cql = null;
		state.pattern.queryBuilder = null;
		state.submittedParameters = null;
		// No need to reset activepattern, just reset the values
	}, 'reset'),

	replace: b.commit((state, payload: ModuleRootState) => {
		actions.activePattern(payload.activePattern);
		actions.resetFilters();
		Object.values(payload.filters).forEach(actions.filter);
		actions.pattern.cql(payload.pattern.cql);
		actions.pattern.queryBuilder(payload.pattern.cql);
		actions.pattern.simple.reset();
		actions.pattern.simple.within(payload.pattern.simple.within);
		Object.values(payload.pattern.simple.annotationValues)/*.forEach(f => Object.values(f)*/.forEach(actions.pattern.simple.annotation)/*)*/;
		state.submittedParameters = payload.submittedParameters;
	}, 'replace')
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = (index: NormalizedIndex) => {
	Object.values(index.annotatedFields).forEach(af => {
		Object.values(af.annotations).filter(annot => !annot.isInternal && annot.hasForwardIndex).forEach(a => {
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
	init
};
