import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import {HistoryEntry} from '@/store/history';
import {create as createSettingsModule, initialState as initialSettingsState, ModuleRootState as SettingsModuleRootState} from '@/store/results/settings';

type ModuleRootState = {
	docs: SettingsModuleRootState;
	hits: SettingsModuleRootState;
};

type ViewId = keyof ModuleRootState;

const initialState: ModuleRootState = {
	docs: Object.assign({}, initialSettingsState),
	hits: Object.assign({}, initialSettingsState), // Make a copy so we don't alias them
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('results', initialState);

const getState = b.state();
const docs = createSettingsModule(b, 'docs');
const hits = createSettingsModule(b, 'hits');

const modules = {
	docs,
	hits,
};

const actions = {
	// viewedResults: b.commit((state, payload: ModuleRootState['viewedResults']) => state.viewedResults = payload, 'viewedResults'),
	resetPage: b.commit(state => Object.values(state).forEach(view => view.page = 0), 'resetPage'),
	resetViewGroup: b.commit(state => Object.values(state).forEach(view => view.viewGroup = null), 'resetViewGroup'),
	resetGroup: b.commit(state => Object.values(state).forEach(view => {
		view.groupBy = [];
		view.viewGroup = null;
	}), 'resetGroup'),
	page: b.commit((state, {viewId, page}: {viewId: ViewId, page: number}) => state[viewId].page = page, 'page'),

	reset: b.commit(state => {
		hits.actions.reset();
		docs.actions.reset();
	}, 'reset'),
	replace: b.commit((state, payload: ModuleRootState) => {
		hits.actions.replace(payload.hits);
		docs.actions.replace(payload.docs);
	}, 'replace'),
	replaceFromHistory: b.dispatch((state, payload: HistoryEntry) => {
		Object.values(modules).forEach(e => e.actions.replaceFromHistory(payload));
	}, 'replaceFromHistory')
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

export {
	ModuleRootState,

	actions,
	init,
	getState,

	modules,
	docs,
	hits,

	ViewId,
};
