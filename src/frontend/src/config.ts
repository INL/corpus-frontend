import Vue from 'vue';
import $ from 'jquery';

import router from '@/pages/config/router';

import ConfigPageComponent from '@/pages/config/ConfigPage.vue'


import '@/global.scss';



$(document).ready(() => {
	new Vue({
		router,
		render: v => v(ConfigPageComponent)
	})
	.$mount(document.querySelector('#vue-root')!);
});
