import {getStoreBuilder} from 'vuex-typex';

import {RootState} from '@/pages/search/state';

/** Search parameters that only update once the form is submitted */
export type ModuleRootState = {
	/* As cql query, includes the within parameter */
	pattern: string|null;
	/* As lucene query */
	filter: string|null;
};

export const initialState: ModuleRootState = {
	pattern: null,
	filter: null
};

const b = getStoreBuilder<RootState>().module<ModuleRootState>('activeSearch', initialState);

export const actions = {
	pattern: b.commit((state, payload: string) => state.pattern = payload, 'submittedPattern'),
	filter: b.commit((state, payload: string) => state.filter = payload, 'submittedFilter')
};

export const get = {
	pattern: b.read(state => state.pattern, 'getSubmittedPattern'),
	filter: b.commit(state => state.filter, 'getSubmittedFilter')
};
