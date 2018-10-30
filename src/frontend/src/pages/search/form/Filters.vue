<template>
	<div>
		<h3>Filter search by &hellip;</h3>

		<ul v-if="useTabs" class="nav nav-tabs">
			<li v-for="(tab, index) in tabs" :class="{'active': index === 0}" :key="index">
				<a :href="'#'+getTabId(tab.name)" data-toggle="tab">{{tab.name}}</a>
			</li>
		</ul>

		<div v-if="useTabs" class="tab-content">
			<div v-for="(tab, index) in tabs"
				:class="['tab-pane', 'form-horizontal', {'active': index === 0}]"
				:key="index"
				:id="getTabId(tab.name)"
			>
				<MetadataFilter v-for="filter in tab.fields" :filter="filter" :key="filter.id"/>
			</div>
		</div>
		<div v-else class="tab-content form-horizontal"> <!-- TODO don't use tab-content when no actually tabs -->
			<MetadataFilter v-for="filter in allFilters" :filter="filter" :key="filter.id"/>
		</div>

		<FilterOverview type="docs" :indexId="indexId"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as corpus from '@/store/corpus';

import FilterOverview from '@/pages/search/form/FilterOverview.vue';
import MetadataFilter from '@/pages/search/form/Filter.vue';

export default Vue.extend({
	components: {
		FilterOverview,
		MetadataFilter
	},
	computed: {
		allFilters() { return corpus.getState().metadataFields },
		tabs: corpus.get.metadataGroups,
		useTabs() {
			return this.tabs.length > 1;
		},
		indexId() { return corpus.getState().id }
	},
	methods: {
		getTabId(name: string) {
			return name.replace(/[^\w]+/g, '_') + '_meta';
		}
	}
})
</script>

<style lang="scss">
</style>