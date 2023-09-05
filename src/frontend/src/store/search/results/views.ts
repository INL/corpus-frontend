/**
 * This module contains a sub-module for every type of results view.
 * The default installation of corpus-frontend supports 'hits' and 'docs' views.
 * But addon scripts can add more views, if required.
 * Those will get their own sub-module here.
 */
import {ModuleBuilder, getStoreBuilder, StoreBuilder} from 'vuex-typex';
import cloneDeep from 'clone-deep';

import {RootState} from '@/store/search/';

const namespace = 'views';

type ModuleRootState = Record<string, ViewRootState>;
type ViewRootState = {
	customState: any;
	/** case-sensitive grouping */
	caseSensitive: boolean;
	groupBy: string[];
	groupByAdvanced: string[];
	page: number;
	sort: string|null;
	viewGroup: string|null;
	groupDisplayMode: string|null;
};

const initialState: ModuleRootState = {};
const initialViewState: ViewRootState = {
	customState: null,
	caseSensitive: false,
	groupBy: [],
	groupByAdvanced: [],
	page: 0,
	sort: null,
	viewGroup: null,
	groupDisplayMode: null,
};

const viewsBuilder = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, cloneDeep(initialState));

const createActions = (b: ModuleBuilder<ViewRootState, RootState>) => ({
	customState: b.commit((state, payload: any) => state.customState = payload, 'customState'),
	caseSensitive: b.commit((state, payload: boolean) => {
		state.caseSensitive = payload;
		state.page = 0;
	}, 'casesensitive'),
	groupBy: b.commit((state, payload: string[]) => {
		state.groupBy = payload;
		state.viewGroup = null;
		state.sort = null;
		state.page = 0;
	} , 'groupby'),
	groupByAdvanced: b.commit((state, payload: string[]) => {
		// can't just replace array since listeners might be attached to properties in a single entry, and they won't be updated.
		state.groupByAdvanced.splice(0, state.groupByAdvanced.length, ...payload);
		state.viewGroup = null;
		state.sort = null;
		state.page = 0;
	}, 'groupByAdvanced'),
	sort: b.commit((state, payload: string|null) => state.sort = payload, 'sort'),
	page: b.commit((state, payload: number) => state.page = payload, 'page'),
	viewGroup: b.commit((state, payload: string|null) => {
		state.viewGroup = payload;
		state.sort = null;
		state.page = 0;
	},'viewgroup'),
	groupDisplayMode: b.commit((state, payload: string|null) => state.groupDisplayMode = payload, 'groupDisplayMode'),

	reset: b.commit(state => Object.assign(state, cloneDeep(initialState)), 'reset'),
	replace: b.commit((state, payload: ViewRootState) => Object.assign(state, cloneDeep(payload)), 'replace'),
});

const createGetters = (b: ModuleBuilder<ViewRootState, RootState>) => {
	return {};
};

/**
 * Create a module with the given namespace and initial state.
 * @param parent global store builder
 * @param namespace key of this module in the root store
 * @param customInitialState if you want to override part of the initial state for this part of the store
 * @returns
 */
export const createViewModule = (viewName: string, customInitialState?: Partial<ViewRootState>) => {
	const b = viewsBuilder.module<ViewRootState>(viewName, cloneDeep(Object.assign(initialViewState, customInitialState))); // Don't alias initialstate of different modules!
	const m = {
		actions: createActions(b),
		get: createGetters(b),
		namespace: viewName,
		getState: b.state(),
	};
	// if already initialized, we need to construct the actual vuex module now.
	// this is a bit hacky, since it isn't supported officially.
	// On the root builder we could call registerModule(), but since this is a ModuleBuilder and not a StoreBuilder,
	// we'll need to do it manually.
	function registerModule(this: any, namespace: string) {
		if (this._store && this._vuexModule) {
			// debugger;
			var mBuilder = this._moduleBuilders[namespace];
			if (!mBuilder)
				throw 'fail to register module: ' + namespace;
			mBuilder._provideStore(this._store);
			var vModule = mBuilder.vuexModule();
			this._store.registerModule([this.namespace, namespace], vModule);
			this._vuexModule.modules[namespace] = vModule;
		}
		else {
			throw 'vuexStore hasn\'t been called yet, use module() instead.';
		}
	}
	registerModule.call(viewsBuilder, viewName);

	// debugger;
	// b.vuexModule(); // late registration, initialize now.
	return m;
};


// store the sub-modules we create so we can access them later
const moduleCache: Record<string, ReturnType<typeof createViewModule>> = {};
function getOrCreateModule(view: string, initialState?: ViewRootState) {
	if (!moduleCache[view]) {
		moduleCache[view] = createViewModule(view, initialState);
	}
	return moduleCache[view];
}

const actions = {
	// groupBy: b.commit((state, payload: string[]) => Object.values(moduleCache).forEach(m => m.actions.groupBy(payload)), 'groupBy'),
	resetPage: viewsBuilder.commit(() => Object.values(moduleCache).forEach(m => m.actions.page(0)), 'resetPage'),
	resetViewGroup: viewsBuilder.commit(() => Object.values(moduleCache).forEach(m => m.actions.viewGroup(null)), 'resetViewGroup'),


	// resetGroup: b.commit(state => {
	// 	actions.resetViewGroup();
	// 	state.hits.groupBy = []; // take care not to alias
	// 	state.docs.groupBy = [];
	// 	state.hits.groupByAdvanced = [];
	// 	state.docs.groupByAdvanced = [];
	// 	state.hits.caseSensitive = false;
	// 	state.docs.caseSensitive = false;
	// }, 'resetGroup'),

	resetAllViews: viewsBuilder.commit(() => Object.values(moduleCache).forEach(m => m.actions.reset()), 'reset'),
	replaceView: viewsBuilder.commit((state, payload: {view: string, data: ViewRootState}) => {
		getOrCreateModule(payload.view).actions.replace(payload.data);
	}, 'replaceResultsView'),
	// replace: b.commit((state, payload: PartialRootState) => {
	// 	DocsModule.actions.replace(payload[DocsModule.namespace]);
	// 	HitsModule.actions.replace(payload[HitsModule.namespace]);
	// 	GlobalModule.actions.replace(payload[GlobalModule.namespace]);
	// }, 'replaceResults'),
};

const get = {

}

const init = () => {
	getOrCreateModule('hits');
	getOrCreateModule('docs');
};

type ViewModule = ReturnType<typeof createViewModule>;

export {
	ViewRootState,
	ModuleRootState,
	ViewModule,
	init,
	getOrCreateModule,
	actions,
	get,
	initialState,
	initialViewState
}