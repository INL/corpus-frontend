<template>
	<table>
		<thead>
			<tr>
				<th style="width:30%;"><a @click="changeSort('identity')">Group</a></th>
				<th style="width:70%;"><a @click="changeSort('numhits')">Hits</a></th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="group in groups" :key="group.identity">
				<td>{{group.identityDisplay || '[unknown]'}}</td>
				<td>
					<div class="progress group-size-indicator" style="cursor:pointer;">
						<div :class="['progress-bar', displayClass]" :style="[{'min-width': width(group)}]">{{group.size}}</div>
					</div>
					<!-- todo spinner, disable loading more, etc -->
					<div v-if="concordances[group.identity]" class="inline-concordance">
						<div>
							<button type="button" class="btn btn-sm btn-link">&#171; View detailed concordances in this group</button>
							<template v-if="concordances[group.identity].moreAvailable">&nbsp;-&nbsp;<button type="button" class="btn btn-sm btn-link">Load more concordances...</button></template>
						</div>
					</div>

					<div class="collapse inline-concordance">
					</div>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

export default Vue.extend({
	props: {
		results: Object as () => BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults,
		// group: Object as () => BLTypes.GroupResult
		sort: String as () => null|string
	},
	data: () => ({
		concordances: {} as {
			[key: string]: {
				concordances: any[]
			}
		}
	}),
	computed: {
		groups(): BLTypes.GroupResult[] {
			return BLTypes.isHitGroups(this.results) ? this.results.hitGroups : this.results.docGroups;
		},
		displayClass(): string {
			return BLTypes.isHitGroups(this.results) ? 'progress-bar-success' : 'progress-bar-warning';
		},
	},
	methods: {
		width(group: BLTypes.GroupResult): string {
			return Math.ceil(group.size / this.results.summary.largestGroupSize * 100) + '%';
		},
		loadConcordances(id: string) {

		},
		changeSort(payload: string) {
			this.$emit('sort', payload === this.sort ? '-'+payload : payload)
		}
	}
});
</script>

<style lang="scss">

</style>

