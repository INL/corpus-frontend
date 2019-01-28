/**
 * This store module contains all local parameters that instantly update the displayed results
 * In this case things like grouping settings, displayed page, sorting
 */

import {getStoreBuilder} from 'vuex-typex';
import {RootState} from '@/store/search/';
import {create, ModuleRootState, initialState as defaults} from '@/store/search/results/module-factory';

const namespace = 'docs';
const b = getStoreBuilder<RootState>();

const {actions, get, getState} = create(b, namespace);

/** We need to call some function from the module before creating the root store or this module won't be evaluated (e.g. none of this code will run) */
const init = () => {/**/};

export {
	ModuleRootState,

	actions,
	get,
	getState,
	init,

	namespace,
	defaults
};
