<template>
	<div>
		<h3>Filter search by &hellip;</h3>

		<template v-if="useTabs">
		<ul class="nav nav-tabs">
			<li v-for="tab in tabs" :class="{'active': activeTab===tab.name}" :key="tab.name" @click.prevent="activeTab=tab.name;">
				<a :href="'#'+tab.name">
					{{tab.name}}
					<span v-if="activeFiltersMap[tab.name]" class="badge" style="background-color:#aaa">
						{{activeFiltersMap[tab.name]}}
					</span>
				</a>
			</li>
		</ul>

		<div class="tab-content">
			<div v-for="(tab, i) in tabs"
				:class="['tab-pane', 'form-horizontal', 'filter-container', {'active': activeTab===tab.name}]"
				:key="tab.name"
				:id="tab.name"
			>
				<template v-for="(subtab, j) in tab.subtabs">
					<h3 v-if="subtab.tabname" :key="j + subtab.tabname">{{subtab.tabname}}</h3>
					<hr v-else-if="j !== 0" :key="j + subtab.tabname">
					<Component v-for="id in subtab.filters" :key="tab.tabname + id"
						:is="filterMap[id].componentName"
						:htmlId="i+(j+id) /* brackets or else i+j collapses before stringifying */"
						:definition="filterMap[id]"
						:textDirection="textDirection"
						:showLabel="subtab.filters.length > 1 || !subtab.tabname"
						:value="filterMap[id].value != null ? filterMap[id].value : undefined"

						@change-value="updateFilterValue(id, $event)"
					/>
				</template>
			</div>
		</div>
		</template>
		<div v-else-if="allFilters.length" class="tab-content form-horizontal filter-container"> <!-- TODO don't use tab-content when no tabs -->
			<Component v-for="filter in allFilters" :key="filter.id"
				:is="filter.componentName"
				:htmlId="`filter_${filter.id}`"
				:definition="filter"
				:textDirection="textDirection"
				:value="filter.value != null ? filter.value : undefined"

				@change-value="updateFilterValue(filter.id, $event)"
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
import { MapOf, mapReduce } from '@/utils';

import { valueFunctions } from '@/components/filters/filterValueFunctions';

import * as RootStore from '@/store/search';

export default Vue.extend({
	components: {
		FilterOverview,
	},
	data: () => ({
		activeTab: null as string|null,
		cancelFilterWatch: [] as Array<() => void>,
	}),
	methods: {
		updateFilterValue(id: string, value: any) { FilterStore.actions.filterValue({id, value}); },
	},
	computed: {
		textDirection(): string { return CorpusStore.getState().textDirection; },
		allFilters(): FilterStore.FullFilterState[] {
			const seenIds = new Set<string>();
			const filterMap = this.filterMap;
			return this.tabs.flatMap(t => t.subtabs.flatMap(tab => tab.filters.map(id => filterMap[id]))).filter(f => {
				const seen = seenIds.has(f.id);
				seenIds.add(f.id);
				return !seen;
			});
		},
		tabs(): Array<{
			name: string;
			subtabs: Array<{
				tabname?: string;
				filters: string[],
			}>;
			query?: MapOf<string[]>;
		}> {
			const availableBuiltinFilters = CorpusStore.get.allMetadataFieldsMap();
			const builtinFiltersToShow = UIStore.getState().search.shared.searchMetadataIds;
			const customFilters = Object.keys(FilterStore.getState().filters).filter(id => !availableBuiltinFilters[id]);
			const allIdsToShow = new Set(builtinFiltersToShow.concat(customFilters));

			// the filters should be in the correct order already
			return FilterStore.getState().filterGroups
				.map(group => ({
					name: group.tabname,
					subtabs: group.subtabs
						.map(subtab => ({
							tabname: subtab.tabname,
							filters: subtab.fields.filter(id => allIdsToShow.has(id))
						}))
						.filter(subtab => subtab.filters.length),
					query: group.query
				}))
				.filter(g => g.subtabs.length);
		},
		filterMap(): MapOf<FilterStore.FullFilterState> { return FilterStore.getState().filters },
		useTabs(): boolean { return this.tabs.length > 1; },
		activeFiltersMap(): MapOf<number> {
			const automaticallyActiveFilters = (this.tabs.find(t => t.name === this.activeTab) || {}).query || {};
			const filterMap = this.filterMap;
			return mapReduce(
				this.tabs,
				'name',
				tab => tab.subtabs.reduce((num, {filters}) => num + filters.filter(f => valueFunctions[filterMap[f].componentName].luceneQuery(f, filterMap[f].metadata, filterMap[f].value) && !automaticallyActiveFilters[f]).length, 0)
			);
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
			this.activeTab = cur.length ? cur[0].name : null;
		},
		activeTab: {
			immediate: true,
			handler(cur: string, prev: string) {
				const curQuery = this.tabs.find(t => t.name === cur)?.query;
				const prevQuery = this.tabs.find(t => t.name === prev)?.query;
				this.cancelFilterWatch.forEach(c => c());
				this.cancelFilterWatch = [];

				if (prevQuery) {
					Object.keys(prevQuery).forEach(id => FilterStore.actions.filterValue({id, value: null}));
				}

				if (curQuery) {
					const allFilters = FilterStore.getState().filters;
					Object.entries(curQuery).forEach(([id, value]) => {
						const filter = allFilters[id];
						const actualValue = valueFunctions[filter.componentName].decodeInitialState(
							id,
							filter.metadata,
							{ [id]: { id: id, values: value } },
							undefined as any
						);

						FilterStore.actions.filterValue({
							id,
							value: actualValue,
						});
						// filthy! Reactivate filter query on global form reset (which otherwise removes it)
						this.cancelFilterWatch.push(
							RootStore.store.watch(state => state.filters.filters[id].value, (cur, prev) => {
								if (cur != prev) {
									FilterStore.actions.filterValue({
										id,
										value: actualValue,
									});
								}
							})
						);
					});
				}
			}
		},
	},
	destroyed() {
		this.cancelFilterWatch.forEach(c => c());
		this.cancelFilterWatch = [];
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