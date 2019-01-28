<template>
	<div class="container">
		<QueryForm/>

		<QuerySummary v-if="resultsVisible" class="cf-panel cf-panel-lg" id="summary"/>
		<Results v-show="resultsVisible" id="results"/>

		<PageGuide/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import $ from 'jquery';

import * as CorpusStore from '@/store/search/corpus';
import * as InterfaceStore from '@/store/search/form/interface';

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
	},
});
</script>

<style lang="scss">

</style>
