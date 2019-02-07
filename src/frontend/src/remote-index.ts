import Vue from 'vue';
import $ from 'jquery';

import RemoteIndexPageComponent from '@/pages/remote-index/RemoteIndexPage.vue';

import '@/global.scss';

$(document).ready(() => {
	new Vue({
		render: v => v(RemoteIndexPageComponent)
	})
	.$mount(document.querySelector('#vue-root')!);
});
