import * as $ from 'jquery';

import {getState, store} from './state';

/*
	This is some ugly-ish code that implements some one- and two-way binding between oldschool normal html elements and the vuex store.
	Once we have all state properly updating in the store and vice versa, migrating components into vue one by one should become easy.
*/

// store.watch(state => state.pageSize,
