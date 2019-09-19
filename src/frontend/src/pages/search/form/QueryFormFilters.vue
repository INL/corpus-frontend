<template>
	<div>
		<h3>Filter search by &hellip;</h3>

		<template v-if="useTabs">
		<ul class="nav nav-tabs">
			<li v-for="tab in tabs" :class="{'active': activeTab===tab.name}" :key="tab.name" @click.prevent="activeTab=tab.name">
				<a :href="'#'+tab.name">{{tab.name}} <span v-if="tab.activeFilters" class="badge" style="background-color:#aaa">{{tab.activeFilters}}</span></a>
			</li>
		</ul>

		<div class="tab-content">
			<div v-for="tab in tabs"
				:class="['tab-pane', 'form-horizontal', 'filter-container', {'active': activeTab===tab.name}]"
				:key="tab.name"
				:id="tab.name"
			>
				<Component v-for="filter in tab.filters" :key="filter.id"
					:is="filter.componentName"
					:definition="filter"
					:textDirection="textDirection"
					:value="filter.value != null ? filter.value : undefined"

					@change-value="updateFilterValue(filter.id, $event)"
					@change-lucene="updateLuceneValue(filter.id, $event)"
					@change-lucene-summary="updateLuceneSummary(filter.id, $event)"
				/>
			</div>
		</div>
		</template>
		<div v-else-if="allFilters.length" class="tab-content form-horizontal filter-container"> <!-- TODO don't use tab-content when no actually tabs -->
			<Component v-for="filter in allFilters" :key="filter.id"
				:is="filter.componentName"
				:definition="filter"
				:textDirection="textDirection"
				:value="filter.value != null ? filter.value : undefined"

				@change-value="updateFilterValue(filter.id, $event)"
				@change-lucene="updateLuceneValue(filter.id, $event)"
				@change-lucene-summary="updateLuceneSummary(filter.id, $event)"
			/>
		</div>
		<div v-else class="text-muted well">
			<h4>No filters available</h4>
			<em>This corpus does not contain metadata, or the author has chosen not to allow filtering on metadata.</em>
		</div>

		<FilterOverview/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as FilterStore from '@/store/search/form/filters';

import FilterOverview from '@/pages/search/form/FilterOverview.vue';

import * as AppTypes from '@/types/apptypes';
import { metadataGroups, mapReduce } from '../../../utils';

export default Vue.extend({
	components: {
		FilterOverview,
	},
	data: () => ({
		activeTab: null as string|null,
	}),
	methods: {
		updateFilterValue(id: string, value: any) { FilterStore.actions.filterValue({id, value}); },
		updateLuceneValue(id: string, lucene: string|null) { FilterStore.actions.filterLucene({id, lucene}); },
		updateLuceneSummary(id: string, summary: string|null) { FilterStore.actions.filterSummary({id, summary}); },
	},
	computed: {
		textDirection(): string { return CorpusStore.getState().textDirection; },
		allFilters(): FilterStore.FullFilterState[] {
			return this.tabs.flatMap(t => t.filters);
		},
		tabs(): Array<{
			name: string;
			filters: FilterStore.FullFilterState[],
			activeFilters: number
		}> {
			const availableBuiltinFilters = CorpusStore.get.allMetadataFieldsMap();
			const builtinFiltersToShow = UIStore.getState().search.shared.searchFilterIds;
			const customFilters = Object.keys(FilterStore.getState().filters).filter(id => !availableBuiltinFilters[id]);
			const order = mapReduce(FilterStore.getState().filterGroups.flatMap(g => g.fields).flatMap(f => ({f})), 'f', (f, index) => index + 1);
			const allIdsToShow = builtinFiltersToShow.concat(customFilters).sort((a, b) => (order[a] || Number.MAX_SAFE_INTEGER) - (order[b] || Number.MAX_SAFE_INTEGER));
			return metadataGroups(
				allIdsToShow,
				FilterStore.getState().filters,
				FilterStore.getState().filterGroups,
			)
			.map(g => ({
				name: g.groupId,
				filters: g.fields,
				activeFilters: g.fields.filter(f => !!f.lucene).length
			}));
		},
		useTabs(): boolean {
			return this.tabs.length > 1;
		},
		indexId(): string { return CorpusStore.getState().id; }
	},
	created() {
		// Always set an active tab if there are any tabs at all
		// new tabs may be added just after setup, changing useTabs from false to true
		this.activeTab = this.tabs.length ? this.tabs[0].name : null;
	},
	watch: {
		tabs(cur, prev) {
			if (cur.length !== prev.length) {
				this.activeTab = cur.length ? cur[0].name : null;
			}
		}
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