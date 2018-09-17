<template>
	<div class="col-xs-12 contentbox" v-show="!!viewedResults">
		<!-- TODO componentize -->
		<div id='totalsReport'>
			<div id="totalsReportText" class="pull-right"></div>
			<span id='totalsSpinner' class="fa fa-spinner fa-spin searchIndicator" style="font-size:16px; padding: 4px; margin: 0px 10px;"></span>
			<div id="totalsLimitedWarning" class="text-danger text-center" style="margin: 0px 10px;">
				<span class="fa fa-exclamation-triangle text-danger" style="font-size: 20px;"></span>
				<br>
				Too many results!
			</div>
		</div>

		<ul id="resultTabs" class="nav nav-tabs">
			<li :class="[{'active': viewedResults === 'hits'}]"><a href="javascript:void(0);" @click="showHits">Per Hit</a></li>
			<li :class="[{'active': viewedResults === 'docs'}]"><a href="javascript:void(0);" @click="showDocs">Per Document</a></li>
		</ul>

		<div class="tab-content">
			<results-view type="hits" v-show="viewedResults === 'hits'"/>
			<results-view type="docs" v-show="viewedResults === 'docs'"/>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import ResultsView from '@/pages/search/ResultsView.vue';

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

<style lang="scss">


</style>