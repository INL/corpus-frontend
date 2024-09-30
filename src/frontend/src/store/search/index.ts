import Vue from 'vue';
import Vuex from 'vuex';

import cloneDeep from 'clone-deep';
import {getStoreBuilder} from 'vuex-typex';

import * as CorpusModule from '@/store/search/corpus';
import * as HistoryModule from '@/store/search/history';
import * as QueryModule from '@/store/search/query';
import * as TagsetModule from '@/store/search/tagset';
import * as UIModule from '@/store/search/ui';

// Form
import * as FormManager from '@/store/search/form';
import * as FilterModule from '@/store/search/form/filters';
import * as InterfaceModule from '@/store/search/form/interface';
import * as PatternModule from '@/store/search/form/patterns';
import * as ExploreModule from '@/store/search/form/explore';
import * as GapModule from '@/store/search/form/gap';
import * as GlossModule from '@/store/search/form/glossStore';
import * as ConceptModule from '@/store/search/form/conceptStore';

// Results
import * as ViewModule from '@/store/search/results/views';
import * as GlobalResultsModule from '@/store/search/results/global';

import * as BLTypes from '@/types/blacklabtypes';
import { getPatternString } from '@/utils';
import { ApiError } from '@/api';

Vue.use(Vuex);

type RootState = {
	// NOTE: any non-module properties need to be supplied to the initial state object passed to the b.vuexStore() call
	// in order to be reactive. (vue needs an initial value to latch on to)
	loadingState: 'loading'|'error'|'loaded'|'requiresLogin'|'unauthorized';
	loadingMessage: string;

	corpus: CorpusModule.ModuleRootState;
	history: HistoryModule.ModuleRootState;
	query: QueryModule.ModuleRootState;
	tagset: TagsetModule.ModuleRootState;
	ui: UIModule.ModuleRootState;
	views: ViewModule.ModuleRootState;
	global: GlobalResultsModule.ModuleRootState;
}&FormManager.PartialRootState;

const b = getStoreBuilder<RootState>();

const getState = b.state();

const get = {
	status: b.read(state => ({message: state.loadingMessage, status: state.loadingState}), 'status'),

	viewedResultsSettings: b.read(state => state.views[state.interface.viewedResults!] ?? null, 'getViewedResultsSettings'),

	/** Whether the filters section should be active (as it isn't active when in specific search modes (e.g. simple or explore)) */
	filtersActive: b.read(state => {
		return !(InterfaceModule.get.form() === 'search' && InterfaceModule.get.patternMode() === 'simple');
	}, 'filtersActive'),
	gapFillingActive: b.read(state => {
		return (InterfaceModule.get.form() === 'search' && InterfaceModule.get.patternMode() === 'expert');
	}, 'gapFillingActive'),
	queryBuilderActive: b.read(state => {
		return InterfaceModule.get.form() === 'search' && InterfaceModule.get.patternMode() === 'advanced';
	}, 'queryBuilderActive'),

	blacklabParameters: b.read((state): BLTypes.BLSearchParameters|undefined => {
		const activeView = get.viewedResultsSettings();
		if (activeView == null) {
			return undefined;
			// throw new Error('Cannot generate blacklab parameters without knowing what kinds of results are being viewed (hits or docs)');
		}

		if (state.query == null) {
			return undefined;
			// throw new Error('Cannot generate blacklab parameters before search form has been submitted');
		}

		if (state.global.sampleSize && state.global.sampleSeed == null) {
			throw new Error('Should provide a sampleSeed when random sampling, or every new page of results will use a different seed');
		}

		return {
			filter: QueryModule.get.filterString(),
			first: state.global.pageSize * activeView.page,
			group: activeView.groupBy.join(','),

			number: state.global.pageSize,
			field: QueryModule.get.annotatedFieldName(),
			patt: QueryModule.get.patternString(),
			pattgapdata: (QueryModule.get.patternString() && QueryModule.getState().gap) ? QueryModule.getState().gap!.value || undefined : undefined,

			sample: (state.global.sampleMode === 'percentage' && state.global.sampleSize) ? state.global.sampleSize : undefined,
			samplenum: (state.global.sampleMode === 'count' && state.global.sampleSize) ? state.global.sampleSize : undefined,
			sampleseed: state.global.sampleSize != null ? state.global.sampleSeed! /* non-null precondition checked above */ : undefined,

			sort: activeView.sort != null ? activeView.sort : undefined,
			viewgroup: activeView.viewGroup != null ? activeView.viewGroup : undefined,
			context: state.global.context != null ? state.global.context : undefined,
			adjusthits: 'yes'
		};
	}, 'blacklabParameters')
};

const privateActions = {
	setLoadingState: b.commit((state, newState: Pick<RootState, 'loadingState'|'loadingMessage'>) => Object.assign(state, newState), 'setLoadingState'),
}

const actions = {
	/** Read the form state, build the query, reset the results page/grouping, etc. */
	searchFromSubmit: b.commit(state => {
		if (state.interface.form === 'search' && state.interface.patternMode === 'extended' && state.patterns.extended.splitBatch) {
			// TODO tidy up implementation of split batch queries
			actions.searchSplitBatches();
			return;
		}
		// Reset the grouping/page/sorting/etc, for all views
		ViewModule.actions.resetAllViews({resetGroupBy: false});

		// Apply the desired grouping for this form, if needed.
		if (state.interface.form === 'explore') {
			switch (state.interface.exploreMode) {
				case 'corpora': {
					// open the 'docs' tab
					InterfaceModule.actions.viewedResults('docs');

					// apply the groupings in the docs tab.
					const m = ViewModule.getOrCreateModule('docs');
					m.actions.groupDisplayMode(state.explore.corpora.groupDisplayMode);
					m.actions.groupBy(state.explore.corpora.groupBy ? [state.explore.corpora.groupBy] : []);
					break;
				}
				case 'frequency':
				case 'ngram': {
					// open the 'hits' tab
					InterfaceModule.actions.viewedResults('hits');
					const m = ViewModule.getOrCreateModule('hits');
					m.actions.groupBy(state.interface.exploreMode === 'ngram' ? [ExploreModule.get.ngram.groupBy()] : [ExploreModule.get.frequency.groupBy()]);
					break;
				}
				default: throw new Error(`Unhandled explore mode ${state.interface.exploreMode} while submitting form`);
			}
		}

		// Open the results, which actually executes the query.
		const oldPattern = QueryModule.get.patternString();
		actions.searchAfterRestore();
		const newPattern = QueryModule.get.patternString();

		let newView = InterfaceModule.get.viewedResults();
		if (newView == null) {
			newView = newPattern ? 'hits' : 'docs';
		} else if (newView === 'hits' && !newPattern) {
			newView = 'docs';
		} else if (oldPattern == null && newPattern != null) {
			newView = 'hits';
		}

		InterfaceModule.actions.viewedResults(newView);
	}, 'searchFromSubmit'),

	/**
	 * Same deal as searchFromSubmit, parse the form and generate the appropriate query, but do not change which, and how results are displayed
	 * This is for when the page is first loaded, the url is decoded and might have contained information about how the results are displayed.
	 * This data is now already in the store, we don't want to clear this.
	 *
	 * NOTE: this does make some assumption that the state shape is valid.
	 * Namely that the groupBy parameter makes sense if the current search mode is ngrams or frequencies.
	 */
	searchAfterRestore: b.commit(state => {
		let submittedFormState: QueryModule.ModuleRootState;

		// jump through some typescript hoops
		const activeForm = InterfaceModule.get.form();
		switch (activeForm) {
			case 'explore': {
				const exploreMode = InterfaceModule.get.exploreMode();
				submittedFormState = {
					form: activeForm,
					subForm: exploreMode,
					// Copy so we don't alias, we should "snapshot" the current form
					// Also cast back into correct type after parsing/stringifying so we don't lose type-safety (parse returns any)
					filters: get.filtersActive() ? cloneDeep(FilterModule.get.activeFiltersMap()) as ReturnType<typeof FilterModule['get']['activeFiltersMap']> : {},
					formState: cloneDeep(ExploreModule.getState()[exploreMode]) as ExploreModule.ModuleRootState[typeof exploreMode],
					parallelVersions: cloneDeep(PatternModule.get.parallelVersions()) as PatternModule.ModuleRootState['parallelVersions'],
					gap: get.gapFillingActive() ? GapModule.getState() : GapModule.defaults,
				};
				break;
			}
			case 'search': { // activeForm === 'search'
				const patternMode = InterfaceModule.get.patternMode();
				submittedFormState = {
					form: activeForm,
					subForm: patternMode,
					// Copy so we don't alias the objects, we should "snapshot" the current form
					// Also cast back into correct type after parsing/stringifying so we don't lose type-safety (parse returns any)
					filters: get.filtersActive() ? cloneDeep(FilterModule.get.activeFiltersMap()) as ReturnType<typeof FilterModule['get']['activeFiltersMap']> : {},
					formState: cloneDeep(PatternModule.getState()[patternMode]) as PatternModule.ModuleRootState[typeof patternMode],
					parallelVersions: cloneDeep(PatternModule.get.parallelVersions()) as PatternModule.ModuleRootState['parallelVersions'],
					gap: get.gapFillingActive() ? GapModule.getState() : GapModule.defaults,
				};
				break;
			}
			default: {
				throw new Error('Form ' + activeForm + ' cannot generate blacklab query; not implemented!');
			}
		}
		QueryModule.actions.search(submittedFormState);
	}, 'searchFromRestore'),

	/**
	 * TODO: this is ugly code, and heavily relies on knowledge about other parts of the codebase, mostly the history objects - clean it up in some manner.
	 *
	 * Split batch queries: allow batch submission of many cql patterns
	 * Works by splitting OR'ed annotations into individual queries containing just that one value.
	 * So say we have
	 * ```typescript
	 * [{
	 *     id: 'lemma',
	 *     value: 'a|b',
	 *     ...
	 * }, {
	 *     id: 'word',
	 *     value: 'c|d',
	 *     ...
	 * }]
	 * ```
	 * Normally the resulting query would be
	 * ```typescript
	 * - [lemma="a|b" & word="c|d"]
	 * ```
	 * But using split batches, the following 4 queries are generated:
	 * ```typescript
	 * - [lemma = "a"]
	 * - [lemma = "b"]
	 * - [word  = "c"]
	 * - [word  = "d"]
	 * ```
	 * Then the first query in the list is submitted, and the rest is pushed into the history so the user can load them at a later moment.
	 */
	searchSplitBatches: b.commit(state => {
		if (state.interface.form !== 'search' || state.interface.patternMode !== 'extended' || !state.patterns.extended.splitBatch) {
			throw new Error('Attempting to submit split batches in wrong view');
		}

		const sharedBatchState: Omit<HistoryModule.HistoryEntry, 'patterns'> = {
			view: ViewModule.getOrCreateModule(InterfaceModule.getState().viewedResults!).getState(),
			explore: ExploreModule.defaults,
			global: GlobalResultsModule.getState(),
			interface: InterfaceModule.getState(),
			filters: get.filtersActive() ? FilterModule.get.activeFiltersMap() : {},
			gap: get.gapFillingActive() ? GapModule.getState() : GapModule.defaults,
			concepts: ConceptModule.getState(),
			glosses: GlossModule.getState(),
		};

		const annotations = PatternModule.get.activeAnnotations();
		const submittedFormStates = annotations
		.filter(a => a.type !== 'pos')
		.flatMap(a => a.value.split('|').map(value => ({...a,value})))
		.map<{
			entry: HistoryModule.HistoryEntry,
			pattern?: string,
			url: string
		}>(a => ({
			entry: {
				...sharedBatchState,
				patterns: {
					advanced: {
						query: null,
						targetQueries: [],
					},
					concept: null,
					glosses: null,
					expert: {
						query: null,
						targetQueries: [],
					},
					parallelVersions: PatternModule.getState().parallelVersions, // <-- is this ok?
					// TODO: this seems wrong..? (why are value and case here?) (JN)
					simple: {...PatternModule.getState().simple, value: '', case: false},
					extended: {
						annotationValues: {
							[a.id]: a
						},
						splitBatch: false,
						withinClauses: state.patterns.extended.withinClauses,
					}
				}
			},
			pattern: getPatternString([a], state.patterns.extended.withinClauses,
				state.patterns.parallelVersions.targets,
				state.patterns.parallelVersions.alignBy || state.ui.search.shared.alignBy.defaultValue),
			// TODO :( url generation is too encapsulated to completely repro here
			url: ''
		}))
		// remove vuex listeners from aliased parts of the store.
		.map(v => cloneDeep(v));

		// We can't just run a submit for every subquery, as that would be REALLY slow.
		// Even if it were fast, mutations within a single vue frame are debounced,
		// so listeners won't be called for any update except the last,
		// preventing the history entries from being created.
		// Unfortunately we need to copy the history entry generation code :(
		// See streams.ts

		submittedFormStates.forEach(HistoryModule.actions.addEntry);
		const mostRecent = HistoryModule.getState()[0];
		if (mostRecent) {
			actions.replace(mostRecent);
		}
	}, 'searchSplitBatches'),

	reset: b.commit(state => {
		FormManager.actions.reset();
		ViewModule.actions.resetAllViews({resetGroupBy: true});
		QueryModule.actions.reset();
	}, 'resetRoot'),

	/**
	 * Is called when loading a search history entry, or when navigating in browser history.
	 * Should fully reset and overwrite form state, and then execute a search.
	*/
	replace: b.commit((_, payload: HistoryModule.HistoryEntry) => {
		FormManager.actions.replace(payload);
		GlobalResultsModule.actions.replace(payload.global);
		// clear all views, otherwise inactive views would persist current settings.
		ViewModule.actions.resetAllViews({resetGroupBy: true});
		// The state we just restored has results open, so execute a search.
		if (payload.interface.viewedResults != null) {
			ViewModule.actions.replaceView({view: payload.interface.viewedResults, data: payload.view});
			actions.searchAfterRestore();
		}
	}, 'replaceRoot'),
};

// NOTE: only call this after creating all getters and actions etc.
// NOTE: process.env is empty at runtime, but webpack inlines all values at compile time, so this check works.
declare const process: any;
const store = b.vuexStore({
	state: {loadingState: 'loading', loadingMessage: 'Please wait while we get the corpus information...'} as RootState, // shut up typescript, the state we pass here is merged with the modules initial states internally.
	strict: process.env.NODE_ENV === 'development',
});

const init = async () => {
	// Load the corpus data, so we can derive values, fallbacks and defaults in the following modules
	// This must happen right at the beginning of the app startup
	try {
		await CorpusModule.init();

		// This is user-customizable data, it can be used to override various defaults from other modules,
		// It needs to determine fallbacks and defaults for settings that haven't been configured,
		// So initialize it before the other modules.
		await UIModule.init();

		await FormManager.init();
		await ViewModule.init();
		await GlobalResultsModule.init();

		await TagsetModule.init();
		await HistoryModule.init();
		await QueryModule.init();
		privateActions.setLoadingState({loadingState: 'loaded', loadingMessage: ''});

		return true;
	} catch (e: any) {
		if (e instanceof ApiError) {
			if (e.httpCode === 401) {
				privateActions.setLoadingState({loadingState: 'requiresLogin', loadingMessage: e.message});
			} else if (e.httpCode === 403) {
				privateActions.setLoadingState({loadingState: 'unauthorized', loadingMessage: e.message});
			} else {
				privateActions.setLoadingState({loadingState: 'error', loadingMessage: e.message});
			}
		} else {
			privateActions.setLoadingState({loadingState: 'error', loadingMessage: e.message ?? e.toString()});
		}
		return false;
	}
};

// Debugging helpers.
(window as any).vuexModules = {
	root: {
		store,
		getState,
		get,
		actions,
		init
	},

	corpus: CorpusModule,
	history: HistoryModule,
	query: QueryModule,
	tagset: TagsetModule,
	ui: UIModule,
	concepts: ConceptModule, // Jesse
	glosses: GlossModule,
	explore: ExploreModule,
	form: FormManager,
	filters: FilterModule,
	interface: InterfaceModule,
	patterns: PatternModule,
	gap: GapModule,

	// backwards-compatibility.
	// docs and hits used to be under results.docs and results.hits. Now they are under views.docs and views.hits
	// While the main module used to be under results. Now it's under views, and the submodules (including hits and docs) are no longer visible directly.
	results: {
		...ViewModule,
		hits: ViewModule.getOrCreateModule('hits'),
		docs: ViewModule.getOrCreateModule('docs'),
	},
	views: ViewModule,
	global: GlobalResultsModule,
};

(window as any).vuexStore = store;

export {
	RootState,

	store,
	getState,
	get,
	actions,
	init,
};
