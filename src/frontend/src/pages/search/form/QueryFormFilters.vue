<template>
	<div>
		<h3>Filter search by &hellip;</h3>

		<template v-if="useTabs">
		<ul class="nav nav-tabs">
			<li v-for="tab in tabs" :class="{'active': activeTab===tab.id}" :key="tab.id" @click.prevent="activeTab=tab.id">
				<a :href="'#'+tab.id">{{tab.displayName}} <span v-if="tab.activeFilters" class="badge" style="background-color:#aaa">{{tab.activeFilters}}</span></a>
			</li>
		</ul>

		<div class="tab-content">
			<div v-for="tab in tabs"
				:class="['tab-pane', 'form-horizontal', 'filter-container', {'active': activeTab===tab.id}]"
				:key="tab.id"
				:id="tab.id"
			>
				<MetadataFilter v-for="filter in tab.filters" :filter="filter" :key="filter.id"/>
			</div>
		</div>
		</template>
		<div v-else class="tab-content form-horizontal filter-container"> <!-- TODO don't use tab-content when no actually tabs -->
			<MetadataFilter v-for="filter in allFilters" :filter="filter" :key="filter.id"/>
		</div>

		<FilterOverview type="docs" :indexId="indexId"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as FilterStore from '@/store/search/form/filters';

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
				acc.push(...tab.filters);
				return acc;
			}, [] as AppTypes.NormalizedMetadataField[]);
		},
		tabs(): Array<{
			id: string;
			displayName: string;
			filters: AppTypes.NormalizedMetadataField[],
			activeFilters: number
		}> {
			return CorpusStore.get.metadataGroups().map(g => ({
				id: g.name.replace(/[^\w]+/g, '_') + '_meta_' + (this as any).uid,
				displayName: g.name,
				filters: g.fields,
				activeFilters: g.fields.filter(f => FilterStore.get.activeFiltersMap()[f.id] != null).length
			}));
		},
		useTabs() {
			return this.tabs.length > 1;
		},
		indexId() { return CorpusStore.getState().id }
	},
	created() {
		this.activeTab = this.useTabs ? this.tabs[0].id : null
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