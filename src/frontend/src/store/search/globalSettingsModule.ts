/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {getStoreBuilder, StoreBuilder, ModuleBuilder} from 'vuex-typex';

import {RootState} from '@/store';

export const enum defaults {
	pageSize = 20,
	sampleMode = 'percentage'
}

export type ModuleRootState = {
	operation: 'hits'|'docs'|null; // TODO rename to view
	pageSize: number;
	sampleMode: 'percentage'|'count';
	sampleSeed: number|null;
	sampleSize: number|null;
	wordsAroundHit: number|null;
};

export const initialState: ModuleRootState = {
	operation: null,
	pageSize: defaults.pageSize as number,
	sampleMode: defaults.sampleMode,
	sampleSeed: null,
	sampleSize: null,
	wordsAroundHit: null
};

const createActions = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	const actions = {
		pageSize: b.commit((state, payload: number) => {
			state.pageSize = [20, 50, 100, 200].includes(payload) ? payload : defaults.pageSize;
		}, 'pagesize'),
		sampleMode: b.commit((state, payload: 'percentage'|'count'|undefined|null) => {
			if (payload == null) { payload = defaults.sampleMode; } // reset on null, ignore on invalid string
			state.sampleMode = ['percentage', 'count'].includes(payload) ? payload : defaults.sampleMode;
		}, 'samplemode'),
		sampleSeed: b.commit((state, payload: number|null) => state.sampleSeed = payload, 'sampleseed'),
		sampleSize: b.commit((state, payload: number|null) => {
			if (payload == null) {
				state.sampleSize = payload;
				return;
			}

			if (state.sampleMode === 'percentage') {
				state.sampleSize = Math.max(0, Math.min(payload, 100));
			} else {
				state.sampleSize = Math.max(0, payload);
			}
		}, 'samplesize'),
		wordsAroundHit: b.commit((state, payload: number|null) => state.wordsAroundHit = payload, 'wordsaroundhit'),

		reset: b.commit(state => Object.assign(state, initialState), 'reset'),
		replace: b.dispatch(({state}, payload: ModuleRootState) => {
			// Use actions so we can verify data
			actions.pageSize(payload.pageSize);
			actions.sampleMode(payload.sampleMode);
			actions.sampleSeed(payload.sampleSeed);
			actions.sampleSize(payload.sampleSize);
			actions.wordsAroundHit(payload.wordsAroundHit);
		}, 'replace'),
	};
	return actions;
};

const createGetters = (b: ModuleBuilder<ModuleRootState, RootState>) => {
	return {};
};

export const create = <M> (parent: StoreBuilder<RootState>|ModuleBuilder<M, RootState>, namespace: string) => {
	const b = parent.module<ModuleRootState>(namespace, initialState);
	return {
		actions: createActions(b),
		get: createGetters(b),
		namespace,
	};
};
