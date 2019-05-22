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
				<Component v-for="filter in tab.filters" :key="filter.id"
					:is="`filter-${filter.uiType}`"

					:id="filter.id"
					:corpusStore="corpusStore"
					:value="filter.value"
					:metadata="filter.metadata"
					:initialLuceneState="initialLuceneState"

					@change-value="updateFilterValue(filter.id, $event)"
					@change-lucene="updateLuceneValue(filter.id, $event)"
					@change-lucene-summary="updateLuceneSummary(filter.id, $event)"
				/>

				<!-- <MetadataFilter v-for="filter in tab.filters" :filter="filter" :key="filter.id"/> -->
			</div>
		</div>
		</template>
		<div v-else class="tab-content form-horizontal filter-container"> <!-- TODO don't use tab-content when no actually tabs -->
			<Component v-for="filter in allFilters" :key="filter.id"
				:is="`filter-${filter.uiType}`"

				:id="filter.id"
				:corpusStore="corpusStore"
				:value="filter.value"
				:metadata="filter.metadata"
				:initialLuceneState="initialLuceneState"

				@change-value="updateFilterValue(filter.id, $event)"
				@change-lucene="updateLuceneValue(filter.id, $event)"
				@change-lucene-summary="updateLuceneSummary(filter.id, $event)"
			/>

			<!-- <MetadataFilter v-for="filter in allFilters" :filter="filter" :key="filter.id"/> -->
		</div>

		<FilterOverview/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as FilterStore from '@/store/search/form/filters';

import FilterOverview from '@/pages/search/form/FilterOverview.vue';
// import MetadataFilter from '@/pages/search/form/Filter.vue';

import FilterAutocomplete from '@/components/filters/FilterAutocomplete.vue';
import FilterCheckbox from '@/components/filters/FilterCheckbox.vue';
import FilterRadio from '@/components/filters/FilterRadio.vue';
import FilterRange from '@/components/filters/FilterRange.vue';
import FilterSelect from '@/components/filters/FilterSelect.vue';
import FilterText from '@/components/filters/FilterText.vue';

import * as AppTypes from '@/types/apptypes';

export default Vue.extend({
	components: {
		FilterOverview,
		// MetadataFilter,
		'filter-autocomplete': FilterAutocomplete,
		'filter-checkbox': FilterCheckbox,
		'filter-radio': FilterRadio,
		'filter-range': FilterRange,
		'filter-select': FilterSelect,
		'filter-text': FilterText,
	},
	data: () => ({
		corpusStore: CorpusStore,
		activeTab: null as string|null,
	}),
	methods: {
		updateFilterValue(id: string, value: any) { FilterStore.actions.filterValue({id, value}); },
		updateLuceneValue(id: string, lucene: string|undefined) { FilterStore.actions.filterLucene({id, lucene}); },
		updateLuceneSummary(id: string, summary: string|undefined) { FilterStore.actions.filterSummary({id, summary}); },
	},
	computed: {
		initialLuceneState: FilterStore.get.initialLuceneState,
		allFilters(): FilterStore.FilterState[] {
			return this.tabs.reduce<FilterStore.FilterState[]>((acc, tab) => {
				acc.push(...tab.filters);
				return acc;
			}, []);
		},
		tabs(): Array<{
			name: string;
			filters: FilterStore.FilterState[],
			activeFilters: number
		}> {
			const groups = FilterStore.get.filterGroups();
			return groups.map(g => ({
				name: g.groupId,
				filters: g.filters,
				activeFilters: g.filters.filter(f => !!f.lucene).length
			}));
		},
		useTabs() {
			return this.tabs.length > 1;
		},
		indexId() { return CorpusStore.getState().id; }
	},
	created() {
		this.activeTab = this.useTabs ? this.tabs[0].name : null;
	}
});
</script>

<style lang="scss">
.filter-container {
	max-height: 385px; // 5 fields @ 74px + 15px padding
	overflow: auto;
	overflow-x: hidden;
}
</style>