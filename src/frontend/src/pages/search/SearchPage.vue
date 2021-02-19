<template>
	<div class="container">
		<QueryForm/>

		<QuerySummary v-if="resultsVisible" class="cf-panel cf-panel-lg" id="summary"/>
		<Debug><div><div>Full query: </div><pre>{{debugQuery}}</pre></div></Debug>

		<Results v-show="resultsVisible" id="results"/>

		<PageGuide v-if="pageGuideEnabled"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as InterfaceStore from '@/store/search/form/interface';
import * as UIStore from '@/store/search/ui';
import * as RootStore from '@/store/search/';

import QueryForm from '@/pages/search/form/QueryForm.vue';
import QuerySummary from '@/pages/search/results/QuerySummary.vue';
import Results from '@/pages/search/results/Results.vue';
import PageGuide from '@/pages/search/PageGuide.vue';

export default Vue.extend({
	components: {
		QueryForm,
		QuerySummary,
		Results,
		PageGuide,
	},
	computed: {
		resultsVisible(): boolean { return InterfaceStore.getState().viewedResults != null; },
		pageGuideEnabled(): boolean { return UIStore.getState().global.pageGuide.enabled; },
		debugQuery(): string { return JSON.stringify(RootStore.get.blacklabParameters(), undefined, 2); }
	},
});
</script>

<style lang="scss">

</style>
