import Vue from 'vue';
import VueRouter from 'vue-router';

import ConfigPage from './ConfigPage.vue';
import CorpusConfig from './CorpusConfig.vue';
import CorpusPicker from './CorpusPicker.vue';
import ConfigPOS from './POS.vue';
import ConfigInterface from './Interface.vue';

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
			path: '/:id/config/:tab?',
			component: CorpusConfig,
			props: route => ({
				id: route.params.id,
				activeTab: route.params.tab,
				tabs: ['pos', 'interface']
			}),
			children: [{
				name: 'pos',
				path: '/:id/config/pos',
				component: ConfigPOS
			}, {
				name: 'interface',
				path: '/:id/config/interface',
				component: ConfigInterface
			}]
		}]
	}]
});

export default router;