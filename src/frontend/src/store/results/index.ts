import {StoreBuilder, ModuleBuilder, getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as SettingsModule from '@/store/results/settings';

export type ModuleRootState = {
	docs: SettingsModule.ModuleRootState;
	hits: SettingsModule.ModuleRootState;
};

export type ViewId = keyof ModuleRootState;

export const initialState: ModuleRootState = {
	docs: Object.assign({}, SettingsModule.initialState),
	hits: Object.assign({}, SettingsModule.initialState), // Make a copy so we don't alias them
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('results', initialState);

export const docs = SettingsModule.create(b, 'docs');
export const hits = SettingsModule.create(b, 'hits');

export const modules = {
	docs,
	hits,
};

export const actions = {
	// viewedResults: b.commit((state, payload: ModuleRootState['viewedResults']) => state.viewedResults = payload, 'viewedResults'),
	resetPage: b.commit(state => Object.values(state).forEach(view => view.page = 0), 'resetPage'),
	resetViewGroup: b.commit(state => Object.values(state).forEach(view => view.viewGroup = null), 'resetViewGroup'),
	page: b.commit((state, {viewId, page}: {viewId: ViewId, page: number}) => state[viewId].page = page, 'page'),

	reset: b.commit(state => {
		hits.actions.reset();
		docs.actions.reset();
	}, 'reset'),
	replace: b.commit((state, payload: ModuleRootState) => {
		hits.actions.replace(payload.hits);
		docs.actions.replace(payload.docs);
	}, 'replace'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
export default () => {/**/};
