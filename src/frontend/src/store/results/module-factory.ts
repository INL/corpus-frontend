/**
 * Can create store modules. Since docs and hits modules are clones of each other.
 */
import {StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';

export type ModuleRootState = {
	/** case-sensitive grouping */
	caseSensitive: boolean;
	groupBy: string[];
	groupByAdvanced: string[];
	page: number;
	sort: string|null;
	viewGroup: string|null;
};

export const initialState: ModuleRootState = {
	caseSensitive: false,
	groupBy: [],
	groupByAdvanced: [],
	page: 0,
	sort: null,
	viewGroup: null
};

const createActions = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	const actions = {
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

		reset: b.commit(state => Object.assign(state, JSON.parse(JSON.stringify(initialState))), 'reset'),
		replace: b.commit((state, payload: ModuleRootState) => Object.assign(state, JSON.parse(JSON.stringify(payload))), 'replace'),
	};
	return actions;
};

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	return {};
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, Object.assign({}, initialState) /* Don't alias initialstate of different modules! */);
	return {
		actions: createActions(b),
		get: createGetters(b),
		namespace,
		getState: b.state(),
	};
};