import Vue from 'vue';
import VueRouter from 'vue-router';

import ConfigPage from './ConfigPage.vue';
import CorpusConfig from './CorpusConfig.vue';
import CorpusPicker from './CorpusPicker.vue';

declare const CONTEXT_URL: string;
declare const INDEX_ID: string|null;

Vue.use(VueRouter);

const router = new VueRouter({
	base: CONTEXT_URL,
	mode: 'history',

	routes: [{
		name: 'config',
		path: '/',
		component: ConfigPage,
		children: [{
			name: 'no_corpus',
			path: '/config',
			component: CorpusPicker,
		}, {
			name: 'corpus',
			path: '/:id/config',
			component: CorpusConfig,
			props: route => ({
				id: route.params.id
			})
		}]
	}]
});

export default router;