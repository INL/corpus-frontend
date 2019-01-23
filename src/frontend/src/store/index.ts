import Vue from 'vue';
import Vuex from 'vuex';
import VueRx from 'vue-rx';

import {getStoreBuilder} from 'vuex-typex';

import * as CorpusModule from '@/store/corpus';
import * as HistoryModule from '@/store/history';
import * as QueryModule from '@/store/query';
import * as TagsetModule from '@/store/tagset';
import * as UIModule from '@/store/ui';

// Form
import * as FormManager from '@/store/form';
import * as FilterModule from '@/store/form/filters';
import * as InterfaceModule from '@/store/form/interface';
import * as PatternModule from '@/store/form/patterns';
import * as ExploreModule from '@/store/form/explore';

// Results
import * as ResultsManager from '@/store/results';
import * as DocResultsModule from '@/store/results/docs';
import * as GlobalResultsModule from '@/store/results/global';
import * as HitResultsModule from '@/store/results/hits';

import * as BLTypes from '@/types/blacklabtypes';

Vue.use(Vuex);
Vue.use(VueRx);

type RootState = {
	corpus: CorpusModule.ModuleRootState;
	history: HistoryModule.ModuleRootState;
	query: QueryModule.ModuleRootState;
	tagset: TagsetModule.ModuleRootState;
	ui: UIModule.ModuleRootState;
}&FormManager.PartialRootState&ResultsManager.PartialRootState;

const b = getStoreBuilder<RootState>();

const getState = b.state();

const get = {
	viewedResultsSettings: b.read(state => state.interface.viewedResults != null ? state[state.interface.viewedResults] : null, 'getViewedResultsSettings'),

	filtersActive: b.read(state => {
		return !(InterfaceModule.get.form() === 'search' && InterfaceModule.get.patternMode() === 'simple');
	}, 'filtersActive'),
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
			group: activeView.groupBy.map(g => g + (activeView.caseSensitive ? ':s':':i')).concat(activeView.groupByAdvanced).join(',') || undefined,

			number: state.global.pageSize,
			patt: QueryModule.get.patternString(),

			sample: (state.global.sampleMode === 'percentage' && state.global.sampleSize) ? state.global.sampleSize : undefined,
			samplenum: (state.global.sampleMode === 'count' && state.global.sampleSize) ? state.global.sampleSize : undefined,
			sampleseed: state.global.sampleSize != null ? state.global.sampleSeed! /* non-null precondition checked above */ : undefined,

			sort: activeView.sort != null ? activeView.sort : undefined,
			viewgroup: activeView.viewGroup != null ? activeView.viewGroup : undefined,
			wordsaroundhit: state.global.wordsAroundHit != null ? state.global.wordsAroundHit : undefined,
		};
	}, 'blacklabParameters')
};

const actions = {
	/** Read the form state, build the query, reset the results page/grouping, etc. */
	searchFromSubmit: b.commit(state => {
		// Reset the grouping/page/sorting/etc
		ResultsManager.actions.resetResults();
		// Apply the desired grouping for this form, if needed.
		if (state.interface.form === 'explore') {
			const exploreMode = state.interface.exploreMode;
			InterfaceModule.actions.viewedResults('hits');
			HitResultsModule.actions.groupBy(exploreMode === 'ngram' ? [ExploreModule.get.ngram.groupBy()] : [ExploreModule.get.frequency.groupBy()]);
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
	 * Same deal, parse the form and generate the appropriate query, but do not change which, and how results are displayed
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
					filters: get.filtersActive() ? JSON.parse(JSON.stringify(FilterModule.get.activeFiltersMap())) as ReturnType<typeof FilterModule['get']['activeFiltersMap']> : {},
					formState: JSON.parse(JSON.stringify(ExploreModule.getState()[exploreMode])) as ExploreModule.ModuleRootState[typeof exploreMode],
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
					filters: get.filtersActive() ? JSON.parse(JSON.stringify(FilterModule.get.activeFiltersMap())) as ReturnType<typeof FilterModule['get']['activeFiltersMap']> : {},
					formState: JSON.parse(JSON.stringify(PatternModule.getState()[patternMode])) as PatternModule.ModuleRootState[typeof patternMode],
				};
				break;
			}
			default: {
				throw new Error('Form ' + activeForm + ' cannot generate blacklab query; not implemented!');
			}
		}
		QueryModule.actions.search(submittedFormState);
	}, 'searchFromRestore'),

	reset: b.commit(state => {
		FormManager.actions.reset();
		ResultsManager.actions.resetResults();
		QueryModule.actions.reset();
	}, 'resetRoot'),

	replace: b.commit((state, payload: HistoryModule.HistoryEntry) => {
		FormManager.actions.replace(payload);
		ResultsManager.actions.replace(payload);

		// The state we just restored has results open, so execute a search.
		if (payload.interface.viewedResults != null) {
			actions.searchAfterRestore();
		}
	}, 'replaceRoot'),
};

// shut up typescript, the state we pass here is merged with the modules initial states internally.
// NOTE: only call this after creating all getters and actions etc.
// NOTE: process.env is empty at runtime, but webpack inlines all values at compile time, so this check works.
declare const process: any;
const store = b.vuexStore({state: {} as RootState, strict: process.env.NODE_ENV === 'development'});

const init = () => {
	CorpusModule.init();

	FormManager.init();
	ResultsManager.init();

	TagsetModule.init();
	HistoryModule.init();
	QueryModule.init();
	UIModule.init();
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

	explore: ExploreModule,
	form: FormManager,
	filters: FilterModule,
	interface: InterfaceModule,
	patterns: PatternModule,

	results: ResultsManager,
	docs: DocResultsModule,
	hits: HitResultsModule,
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
