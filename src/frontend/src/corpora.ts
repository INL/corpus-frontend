
import Vue from 'vue';
//@ts-ignore
import VuePlausible from 'vue-plausible/lib/esm/vue-plugin.js';
import CorporaPageComponent from '@/pages/corpora/CorporaPage.vue';
import DebugComponent from '@/components/Debug.vue';

import * as loginSystem from '@/utils/loginsystem';
import { init as initApi } from '@/api';

import '@/global.scss';

if (PLAUSIBLE_DOMAIN && PLAUSIBLE_APIHOST) {
	Vue.use(VuePlausible, {
		domain: PLAUSIBLE_DOMAIN,
		trackLocalhost: true,
		apiHost: PLAUSIBLE_APIHOST,
	});
	//@ts-ignore
	Vue.$plausible.trackPageview();
}

Vue.component('Debug', DebugComponent);


$(document).ready(async () => {
	const user = await loginSystem.awaitInit();
	initApi('blacklab', BLS_URL, user);
	initApi('cf', CONTEXT_URL, user);

	// We can render before the tagset loads, the form just won't be populated from the url yet.
	(window as any).vueRoot = new Vue({
		render: h => h(CorporaPageComponent),
	}).$mount(document.querySelector('#vue-root')!);
});
