/**
 * This store module contains all local parameters that instantly update the displayed results
 * In this case things like grouping settings, displayed page, sorting
 */

import {StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';

export type ModuleRootState = {
	/** case-sensitive grouping */
	caseSensitive: boolean;
	groupBy: string[];
	page: number;
	sort: string|null;
	viewGroup: string|null;
};

export const initialState: ModuleRootState = {
	caseSensitive: false,
	groupBy: [],
	page: 0,
	sort: null,
	viewGroup: null
};

const createActions = (b: ModuleBuilder<ModuleRootState, RootState>) => ({
	caseSensitive: b.commit((state, payload: boolean) => state.caseSensitive = payload, 'casesensitive'),
	groupBy: b.commit((state, payload: string[]) => {
		state.groupBy = payload;
		state.viewGroup = null;
		state.sort = null;
		state.page = 0;
	} , 'groupby'),
	sort: b.commit((state, payload: string|null) => state.sort = payload, 'sort'),
	page: b.commit((state, payload: number) => state.page = payload, 'page'),
	viewGroup: b.commit((state, payload: string|null) => {
		state.viewGroup = payload;
		state.sort = null;
		state.page = 0;
	},'viewgroup'),

	reset: b.commit(state => Object.assign(state, initialState), 'reset'),
	replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, payload), 'replace'),
});

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	return {};
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, initialState);
	return {
		actions: createActions(b),
		get: createGetters(b),
		namespace,
		getState: b.state(),
	};
};
