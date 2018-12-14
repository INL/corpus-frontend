import {getStoreBuilder} from 'vuex-typex';

import * as HitsModule from '@/store/results/hits';
import * as DocsModule from '@/store/results/docs';
import * as GlobalModule from '@/store/results/global';

type ViewId = Exclude<keyof PartialRootState, 'global'>;

type PartialRootState = {
	docs: DocsModule.ModuleRootState;
	global: GlobalModule.ModuleRootState;
	hits: HitsModule.ModuleRootState;
};

const b = getStoreBuilder<PartialRootState>();

const get = {
	resultsModules() {
		return [HitsModule, DocsModule];
	}
};

const actions = {
	groupBy: b.commit((state, payload: string[]) => {
		HitsModule.actions.groupBy(payload);
		DocsModule.actions.groupBy(payload);
	}, 'groupBy'),

	resetPage: b.commit(state => state.hits.page = state.docs.page = 0, 'resetPage'),
	resetViewGroup: b.commit(state => state.hits.viewGroup = state.docs.viewGroup = null, 'resetViewGroup'),
	resetGroup: b.commit(state => {
		actions.resetViewGroup();
		state.hits.groupBy = []; // take care not to alias
		state.docs.groupBy = [];
		state.hits.groupByAdvanced = [];
		state.docs.groupByAdvanced = [];
		state.hits.caseSensitive = false;
		state.docs.caseSensitive = false;
	}, 'resetGroup'),

	resetResults: b.commit(() => {
		HitsModule.actions.reset();
		DocsModule.actions.reset();
	}, 'resetResultsLocal'),
	resetGlobal: b.commit(() => {
		GlobalModule.actions.reset();
	}, 'resetResultsGlobal'),
	reset: b.commit(() => {
		actions.resetResults();
		actions.resetGlobal();
	}, 'resetResultsAll'),
	replace: b.commit((state, payload: PartialRootState) => {
		DocsModule.actions.replace(payload[DocsModule.namespace]);
		HitsModule.actions.replace(payload[HitsModule.namespace]);
		GlobalModule.actions.replace(payload[GlobalModule.namespace]);
	}, 'replaceResults'),
};

const init = () => {
	DocsModule.init();
	GlobalModule.init();
	HitsModule.init();
};

export {
	PartialRootState,
	ViewId,

	get,
	actions,
	init,
};
