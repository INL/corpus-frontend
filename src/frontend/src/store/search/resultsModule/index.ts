import {StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import * as SettingsModule from '@/store/search/resultsModule/settingsModule';

export type ModuleRootState = {
	viewedResults: null|keyof ModuleRootState['settings'];
	settings: {
		hits: SettingsModule.ModuleRootState;
		docs: SettingsModule.ModuleRootState;
	};
};

export const initialState: ModuleRootState = {
	viewedResults: null,
	settings: {
		hits: Object.assign({}, SettingsModule.initialState), // Make a copy so we don't alias them
		docs: Object.assign({}, SettingsModule.initialState),
	}
};

const createActions = (b: ModuleBuilder<ModuleRootState, RootState>, submodules: {[key: string]: ReturnType<typeof SettingsModule.create>}) => {
	return {
		viewedResults: b.commit((state, payload: ModuleRootState['viewedResults']) => state.viewedResults = payload, 'viewedResults'),
		reset: b.commit(state => {
			state.viewedResults = null;
			Object.values(submodules).forEach(m => m.actions.reset());
		}, 'reset'),
		replace: b.commit((state, payload: ModuleRootState) => {
			state.viewedResults = payload.viewedResults;
			Object.entries(state.settings).forEach(([viewId, settings]) => {
				Object.assign(settings, payload.settings[viewId]);
			});
		}, 'replace')
	};
};

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>, submodules: {[key: string]: ReturnType<typeof SettingsModule.create>}) => {
	return {
		activeSettings: b.read(state => state.viewedResults ? state.settings[state.viewedResults] : null, 'activeSettings'),
	};
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, initialState);

	const settingsModuleModule = b.module<ModuleRootState['settings']>('settings', initialState.settings);

	const submodules = {
		hits: SettingsModule.create(settingsModuleModule, 'hits'),
		docs: SettingsModule.create(settingsModuleModule, 'docs'),
	};

	return {
		actions: createActions(b, submodules),
		get: createGetters(b, submodules),
		namespace,

		...submodules
	};
};
