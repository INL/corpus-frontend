import {getStoreBuilder} from 'vuex-typex';

import { RootState } from '@/store/search/';

import * as ExploreModule from '@/store/search/form/explore';
import * as FilterModule from '@/store/search/form/filters';
import * as InterfaceModule from '@/store/search/form/interface';
import * as PatternModule from '@/store/search/form/patterns';
import * as GapModule from '@/store/search/form/gap';

type PartialRootState = {
	explore: ExploreModule.ModuleRootState;
	filters: FilterModule.ModuleRootState;
	interface: InterfaceModule.ModuleRootState;
	patterns: PatternModule.ModuleRootState;
	gap: GapModule.ModuleRootState;
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
		GapModule.actions.reset();
	}, 'resetForm'),

	replace: b.commit((state, payload: PartialRootState) => {
		ExploreModule.actions.replace(payload.explore);
		FilterModule.actions.replace(payload.filters);
		PatternModule.actions.replace(payload.patterns);
		InterfaceModule.actions.replace(payload.interface);
		GapModule.actions.replace(payload.gap);
	}, 'replaceForm')
};

const init = () => {
	ExploreModule.init();
	FilterModule.init();
	InterfaceModule.init();
	PatternModule.init();
	GapModule.init();
};

export {
	PartialRootState,

	get,
	actions,
	init,
};
