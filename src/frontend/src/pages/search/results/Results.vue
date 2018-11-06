<template>
	<div>
		<ul id="resultTabs" class="nav nav-tabs cf-panel-tab-header cf-panel-lg">
			<li :class="[{'active': viewedResults === 'hits'}]"><a href="javascript:void(0);" @click="showHits">Per Hit</a></li>
			<li :class="[{'active': viewedResults === 'docs'}]"><a href="javascript:void(0);" @click="showDocs">Per Document</a></li>
		</ul>

		<div class="tab-content cf-panel-tab-body cf-panel-lg" style="padding-top: 0px;">
			<results-view type="hits"/>
			<results-view type="docs"/>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import ResultsView from '@/pages/search/results/ResultsView.vue';

import * as store from '@/store';
import * as resultsStore from '@/store/results';

export default Vue.extend({
	components: {
		ResultsView,
	},
	methods: {
		showHits() {
			store.actions.viewedResults('hits');
		},
		showDocs() {
			store.actions.viewedResults('docs');
		}
	},
	computed: {
		viewedResults: store.get.viewedResults,
	}
});
</script>

<style lang="scss" scoped>
</style>