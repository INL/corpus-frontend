import {getStoreBuilder} from 'vuex-typex';

import { RootState } from '@/store';

import * as ExploreModule from '@/store/form/explore';
import * as FilterModule from '@/store/form/filters';
import * as InterfaceModule from '@/store/form/interface';
import * as PatternModule from '@/store/form/patterns';

type PartialRootState = {
	explore: ExploreModule.ModuleRootState;
	filters: FilterModule.ModuleRootState;
	interface: InterfaceModule.ModuleRootState;
	patterns: PatternModule.ModuleRootState;
};

const b = getStoreBuilder<RootState>();

const get = {
	// nothing yet.
};

const actions = {
	reset: b.commit(() => {
		ExploreModule.actions.reset();
		FilterModule.actions.reset();
		InterfaceModule.actions.viewedResults(null);
		PatternModule.actions.reset();
	}, 'resetForm'),

	replace: b.commit((state, payload: PartialRootState) => {
		ExploreModule.actions.replace(payload.explore);
		FilterModule.actions.replace(payload.filters);
		PatternModule.actions.replace(payload.patterns);
		InterfaceModule.actions.replace(payload.interface);
	}, 'replaceForm')
};

const init = () => {
	ExploreModule.init();
	FilterModule.init();
	InterfaceModule.init();
	PatternModule.init();
};

export {
	PartialRootState,

	get,
	actions,
	init,
};