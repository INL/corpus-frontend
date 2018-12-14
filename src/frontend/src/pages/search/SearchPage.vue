<template>
	<div class="container">
		<ul class="nav nav-tabs cf-panel-tab-header cf-panel-lg">
			<li :class="{'active': activeForm==='search'}" @click.prevent="activeForm='search'"><a href="#form-search">Search</a></li>
			<li :class="{'active': activeForm==='explore'}" @click.prevent="activeForm='explore'"><a href="#form-explore">Explore</a></li>
		</ul>
		<div class="tab-content cf-panel-tab-body cf-panel-lg" style="padding-top: 0;">
			<SearchForm  id="form-search"  :class="['tab-pane', {'active': activeForm==='search'}]"/>
			<ExploreForm id="form-explore" :class="['tab-pane', {'active': activeForm==='explore'}]"/>
		</div>

		<QuerySummary v-if="resultsVisible" class="cf-panel cf-panel-lg" id="summary"/>
		<Results v-show="resultsVisible" id="results"/>

		<History/>
		<PageGuide/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import $ from 'jquery';

import * as CorpusStore from '@/store/corpus';
import * as InterfaceStore from '@/store/form/interface';

import SearchForm from '@/pages/search/form/SearchForm.vue';
import ExploreForm from '@/pages/search/form/ExploreForm.vue';
import QuerySummary from '@/pages/search/results/QuerySummary.vue';
import Results from '@/pages/search/results/Results.vue';
import History from '@/pages/search/History.vue';
import PageGuide from '@/pages/search/PageGuide.vue';

export default Vue.extend({
	components: {
		SearchForm,
		ExploreForm,
		QuerySummary,
		Results,
		History,
		PageGuide,
	},
	computed: {
		title(): string { return CorpusStore.getState().displayName; },
		resultsVisible(): boolean { return InterfaceStore.getState().viewedResults != null; },

		activeForm: {
			get(): string { return InterfaceStore.getState().form; },
			set(v: 'search'|'explore') { InterfaceStore.actions.form(v); }
		}
	},
});
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
