import $ from 'jquery';

import Vue from 'vue';
import {StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import {FilterField, PropertyField} from '@/types/pagetypes';
import { getPatternString } from '@/modules/singlepage-bls';
import { debugLog } from '@/utils/debug';

export type ModuleRootState = {
	filters: { [key: string]: FilterField };

	activePattern: keyof ModuleRootState['pattern'];
	pattern: {
		cql: string|null;
		queryBuilder: string|null;
		simple: {
			annotationValues: {[key: string]: PropertyField},
			within: string|null;
		}
	};

	/** These were the parameters the last time the query was submitted, a somewhat processed version of the rest of the state */
	submittedParameters: null|{
		pattern: null|string;
		/** Only contains filters with a value */
		filters: FilterField[];
	}
};

// There are three levels of state initialization
// First: the basic state shape (this)
// Then: the basic state shape with the appropriate annotation and filters created
// Finally: the values initialized from the page's url on first load.
export const initialState: ModuleRootState = {
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

const createActions = (b: ModuleBuilder<ModuleRootState, RootState>, ownGetters: ReturnType<typeof createGetters>) => {
	const actions = {
		filter: b.commit((state, {id, values}: {id: string, values: string[]}) => state.filters[id].values = values, 'filter'),
		resetFilters: b.commit(state => Object.values(state.filters).forEach(filter => filter.values = []), 'filter_reset'),

		activePattern: b.commit((state, payload: ModuleRootState['activePattern']) => state.activePattern = payload, 'activePattern'),
		pattern: {
			simple: {
				annotation: b.commit((state, {id, ...rest}: Partial<PropertyField>&{id: string}) => Object.assign(state.pattern.simple.annotationValues[id], rest), 'simple_value'),
				within: b.commit((state, payload: string|null) => state.pattern.simple.within = payload, 'simple_within'),
				reset: b.commit(state => {
					Object.values(state.pattern.simple.annotationValues).forEach(prop => {
						prop.value = '';
						prop.case = false;
					});
					state.pattern.simple.within = null;
				}, 'pattern_simple_reset'),
			},
			queryBuilder: b.commit((state, payload: string|null) =>state.pattern.queryBuilder = payload, 'querybuilder'),
			cql: b.commit((state, payload: string|null) => state.pattern.cql = payload, 'cql')
		},

		search: b.commit(state => {
			// Get the state without the submittedParameters key
			state.submittedParameters = {
				filters: ownGetters.activeFilters(),
				pattern: state.activePattern ? getPatternString(state.pattern[state.activePattern])||null : null,
			};

			// if (state.activePattern === 'cql' && state.pattern.cql) {
			// 	newSubmittedParameters.pattern = {
			// 		type: 'cql',
			// 		value: state.pattern.cql
			// 	};
			// } else if (state.activePattern === 'queryBuilder' && state.pattern.queryBuilder) {
			// 	newSubmittedParameters.pattern = {
			// 		type: 'cql',
			// 		value: state.pattern.queryBuilder
			// 	};
			// } else if (state.activePattern === 'simple') {
			// 	const activeAnnotations = ownGetters.activeAnnotations();
			// 	if (activeAnnotations.length) {
			// 		newSubmittedParameters.pattern = {
			// 			type: 'annotations',
			// 			value: activeAnnotations,
			// 		};
			// 		if (state.pattern.simple.within != null) {
			// 			newSubmittedParameters.pattern.within = state.pattern.simple.within
			// 		}
			// 	}
			// } // else submittedPattern.pattern remains null, no cql has been entered
			// state.submittedParameters = newSubmittedParameters;
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
			Object.values(payload.pattern.simple.annotationValues).forEach(actions.pattern.simple.annotation);
			state.submittedParameters = payload.submittedParameters;
		}, 'replace')
	};
	return actions;
};

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	const get = {
		/** Last submitted properties, these are already filtered to remove empty values, etc */
		lastSubmittedPattern: b.read(state => state.submittedParameters, 'lastSubmittedParameters'),
		activeAnnotations: b.read(state => Object.values(state.pattern.simple.annotationValues).filter(p => !!p.value), 'activeAnnotations'),
		activeFilters: b.read(state => Object.values(state.filters).filter(f => f.values.length > 0), 'activeFilters'),
		activePatternValue: b.read(state => state.activePattern ? state.pattern[state.activePattern] : null, 'activePatternValue')
	};
	return get;
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, initialState);

	// ------------------------------------------------
	// One time initialization (on page load/first use)
	// ------------------------------------------------

	const initFilter = b.commit((state, payload: FilterField) => Vue.set(state.filters, payload.id, payload), 'filter_init');
	const initAnnotation = b.commit((state, payload: PropertyField) => Vue.set(state.pattern.simple.annotationValues, payload.id, payload), 'annotation_init');

	// Initialize state shape
	// This should run before state is rehydrated from URL (on initial page load)
	// TODO initialize state shape from indexmetadata instead of dom layout
	$(document).ready(() => {
		$('.propertyfield').each(function() {
			const $this = $(this);
			const id = $this.attr('id')!;

			initAnnotation({
				id,
				value: '',
				case: false,
			});
		});

		$('.filterfield').each(function() {
			const $this = $(this);
			const id = $this.attr('id')!;
			const type = $this.data('filterfield-type') as FilterField['filterType'];

			initFilter({
				id,
				filterType: type,
				values: []
			});
		});

		debugLog('Finished initializing formModule state shape');
	});

	const get = createGetters(b);
	return {
		actions: createActions(b, get),
		get,
		namespace,
	};
};
