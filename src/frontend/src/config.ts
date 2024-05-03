import 'bootstrap';

import Vue from 'vue';
import $ from 'jquery';

import router from '@/pages/config/router';

import ConfigPageComponent from '@/pages/config/ConfigPage.vue'
import * as loginSystem from '@/utils/loginsystem';

import { init as initApi } from '@/api/index';

import '@/global.scss';
import '@/utils/i18n';


$(document).ready(async () => {
	// we do this after render, so the user has something to look at while we're loading.
	const user = await loginSystem.awaitInit(); // LOGIN SYSTEM
	initApi('blacklab', BLS_URL, user);
	initApi('cf', CONTEXT_URL, user);

	new Vue({
		router,
		render: v => v(ConfigPageComponent)
	})
	.$mount(document.querySelector('#vue-root')!);
});
