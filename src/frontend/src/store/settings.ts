/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store';
import {HistoryEntry} from '@/store/history';

const defaults = {
	pageSize: 20,
	sampleMode: 'percentage' as 'percentage' // required to allow putting it in string enum types
};

type ModuleRootState = {
	pageSize: number;
	sampleMode: 'percentage'|'count';
	sampleSeed: number|null;
	sampleSize: number|null;
	wordsAroundHit: number|null;
};

const initialState: ModuleRootState = {
	pageSize: defaults.pageSize as number,
	sampleMode: defaults.sampleMode,
	sampleSeed: null,
	sampleSize: null,
	wordsAroundHit: null
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('settings', initialState);

const getState = b.state();

const get = {
	// nothing here yet
};

const actions = {
	pageSize: b.commit((state, payload: number) => {
		state.pageSize = [20, 50, 100, 200].includes(payload) ? payload : defaults.pageSize;
	}, 'pagesize'),
	sampleMode: b.commit((state, payload: 'percentage'|'count'|string|undefined|null) => {
		if (payload == null) { payload = defaults.sampleMode; } // reset on null, ignore on invalid string
		state.sampleMode = ['percentage', 'count'].includes(payload) ? payload as any : defaults.sampleMode;
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
	replaceFromHistory: b.dispatch(({state}, payload: HistoryEntry) => {
		// Reset only some values
		actions.sampleMode(null);
		actions.sampleSeed(null);
		actions.sampleSize(null);
	}, 'replaceFromHistory'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

export {
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	defaults
};
