<template>
	<div class="container">
		<SearchForm id="form-search" class="cf-panel cf-panel-lg"/>

		<QuerySummary v-if="resultsVisible" class="cf-panel cf-panel-lg" id="summary"/>
		<Results v-show="resultsVisible" id="results"/>

		<PageGuide/>
		<History/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import $ from 'jquery';

import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';

import SearchForm from '@/pages/search/form/SearchForm.vue';
import QuerySummary from '@/pages/search/results/QuerySummary.vue';
import Results from '@/pages/search/results/Results.vue';
import History from '@/pages/search/History.vue';
import PageGuide from '@/pages/search/PageGuide.vue';

declare const PATH_TO_TOP: string; // TODO

export default Vue.extend({
	components: {
		SearchForm,
		QuerySummary,
		Results,
		History,
		PageGuide,
	},
	computed: {
		title(): string { return CorpusStore.getState().displayName; },
		showHomeLink(): boolean { return CorpusStore.getState().owner != null; },
		homeLink(): string { return PATH_TO_TOP; },
		resultsVisible(): boolean { return RootStore.getState().viewedResults != null; }
	},
})

</script>

<style lang="scss">

#corpus-title {
	text-transform: capitalize;
	margin: 0;
}

#corpora-link {
	display: inline-block;
	margin: 10px 0 2px;
	position: relative;

	&:before {
		content: "«";
		position: absolute;
		left: -12px;
	}
}

</style>
