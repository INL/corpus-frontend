<template>
	<div>
		<h3>Filter search by &hellip;</h3>

		<ul v-if="useTabs" class="nav nav-tabs">
			<li v-for="(tab, index) in tabs" :class="{'active': activeTab===getTabId(tab.name)}" :key="index" @click.prevent="activeTab=getTabId(tab.name)">
				<a :href="'#'+getTabId(tab.name)">{{tab.name}}</a>
			</li>
		</ul>

		<div v-if="useTabs" class="tab-content">
			<div v-for="(tab, index) in tabs"
				:class="['tab-pane', 'form-horizontal', 'filter-container', {'active': activeTab===getTabId(tab.name)}]"
				:key="index"
				:id="getTabId(tab.name)"
			>
				<MetadataFilter v-for="filter in tab.fields" :filter="filter" :key="filter.id"/>
			</div>
		</div>
		<div v-else class="tab-content form-horizontal filter-container"> <!-- TODO don't use tab-content when no actually tabs -->
			<MetadataFilter v-for="filter in allFilters" :filter="filter" :key="filter.id"/>
		</div>

		<FilterOverview type="docs" :indexId="indexId"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';

import FilterOverview from '@/pages/search/form/FilterOverview.vue';
import MetadataFilter from '@/pages/search/form/Filter.vue';

import * as AppTypes from '@/types/apptypes';

export default Vue.extend({
	components: {
		FilterOverview,
		MetadataFilter
	},
	data: () => ({
		activeTab: null as string|null,
	}),
	computed: {
		allFilters(): AppTypes.NormalizedMetadataField[] {
			return this.tabs.reduce((acc, tab) => {
				acc.push(...tab.fields);
				return acc;
			}, [] as AppTypes.NormalizedMetadataField[]);
		},
		tabs: CorpusStore.get.metadataGroups,
		useTabs() {
			return this.tabs.length > 1;
		},
		indexId() { return CorpusStore.getState().id }
	},
	methods: {
		getTabId(name: string) {
			return name.replace(/[^\w]+/g, '_') + '_meta_' + (this as any).uid;
		}
	},
	created() {
		this.activeTab = this.useTabs ? this.getTabId(this.tabs[0].name) : null
	}
})
</script>

<style lang="scss">
.filter-container {
	max-height: 385px; // 5 fields @ 74px + 15px padding
	overflow: auto;
	overflow-x: hidden;
}
</style>