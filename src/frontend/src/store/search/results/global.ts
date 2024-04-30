/**
 * This store module contains all global parameters that instantly update the displayed results
 * Think things like page size, context size, random sampling settings
 */

import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/store/search/';

const defaults = {
	pageSize: 20,
	sampleMode: 'percentage' as 'percentage' // required to allow putting it in string enum types
};

const namespace = 'global';
type ExternalModuleRootState = {
	pageSize: number;
	sampleMode: 'percentage'|'count';
	sampleSeed: number|null;
	sampleSize: number|null;
	/** context can be a string or number in BlackLab, but for now in the form we only allow numbers. */
	context: number|string|null;
};

// We don't want to expose this internal state to the outside world
// It's easier this way, since we don't have to worry about this setting in history parsing/generation, url parsing/generation, etc.
type ModuleRootState=ExternalModuleRootState&{
	resetGroupByOnSearch: boolean;
}

const initialState: ExternalModuleRootState = {
	pageSize: defaults.pageSize as number,
	sampleMode: defaults.sampleMode,
	sampleSeed: null,
	sampleSize: null,
	context: null,
};

const internalInitialState: ModuleRootState = {
	...initialState, resetGroupByOnSearch: true
}

const b = getStoreBuilder<RootState>().module<ModuleRootState>(namespace, Object.assign({}, internalInitialState));

const getState = b.state();

const get = {
	resetGroupByOnSearch: b.read((state) => state.resetGroupByOnSearch, 'resetGroupByOnSearch'),
};

const actions = {
	pageSize: b.commit((state, payload: number) => {
		state.pageSize = [20, 50, 100, 200].includes(payload) ? payload : defaults.pageSize;
	}, 'pagesize'),
	sampleMode: b.commit((state, payload?: 'percentage'|'count') => {
		// reset on null, undefined, invalid strings
		if (!['percentage', 'count'].includes(payload as any)) { payload = defaults.sampleMode; }
		if (payload === state.sampleMode) { return; }
		state.sampleMode =  payload as any;
		state.sampleSize = null;
	}, 'samplemode'),
	sampleSeed: b.commit((state, payload: number|null) => {
		// Must have a seed when there is a size (e.g. random sampling is active)
		if (state.sampleSize != null && payload == null) {
			payload = Number.MAX_SAFE_INTEGER - (Math.random() * 2 * Number.MAX_SAFE_INTEGER);
		}
		state.sampleSeed = payload;
	}, 'sampleseed'),
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

		// null check already passed
		// if missing seed, randomize it now
		if (state.sampleSeed == null) {
			actions.sampleSeed(Number.MAX_SAFE_INTEGER - (Math.random() * 2 * Number.MAX_SAFE_INTEGER));
		}

	}, 'samplesize'),
	context: b.commit((state, payload: number|string|null) => state.context = payload, 'context'),
	resetGroupByOnSearch: b.commit((state, payload: boolean) => state.resetGroupByOnSearch = payload, 'resetGroupByOnSearch'),

	reset: b.commit(state => Object.assign(state, internalInitialState), 'reset'),
	replace: b.commit((state, payload: ExternalModuleRootState) => {
		// Use actions so we can verify data
		actions.pageSize(payload.pageSize);
		actions.sampleMode(payload.sampleMode);
		actions.sampleSeed(payload.sampleSeed);
		actions.sampleSize(payload.sampleSize);
		actions.context(payload.context);
	}, 'replace'),
};

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

export {
	ExternalModuleRootState,
	ModuleRootState,

	getState,
	get,
	actions,
	init,

	namespace,
	defaults
};
