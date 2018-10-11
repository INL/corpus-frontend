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
					<div class="progress group-size-indicator" style="cursor:pointer;" @click="openPreviewConcordances(group.identity)">
						<div :class="['progress-bar', displayClass]" :style="[{'min-width': width(group)}]">{{group.size}}</div>
					</div>

					<!-- todo spinner, disable loading more, etc -->
					<div v-if="concordances[group.identity] && concordances[group.identity].open">
						<div>
							<button type="button" class="btn btn-sm btn-link" @click="openFullConcordances(group.identity, group.identityDisplay)">&#171; View detailed concordances in this group</button>
							<template v-if="concordances[group.identity].available > concordances[group.identity].concordances.length">
								&nbsp;-&nbsp;<button
									type="button"
									class="btn btn-sm btn-link"
									@click="loadPreviewConcordances(group.identity)"
									:disabled="concordances[group.identity].request != null"
								>{{`${concordances[group.identity].request != null ? 'loading...' : 'Load more concordances...'}`}}</button>
							</template>
						</div>

						<template v-if="type === 'hits'">
							<div v-for="(conc, index) in concordances[group.identity].concordances" :key="index" class="clearfix">
								<div class="col-xs-5 text-right">&hellip; {{conc.left}}</div>
								<div class="col-xs-2 text-center"><strong>{{conc.hit}}&nbsp;</strong></div>
								<div class="col-xs-5">{{conc.right}} &hellip;</div>
							</div>
						</template>
						<template v-else>
							<div v-for="(conc, index) in concordances[group.identity].concordances" :key="index" class="clearfix">
								<div class="col-xs-10"><strong>{{conc.title}}&nbsp;</strong></div>
								<div class="col-xs-2">{{conc.hits}}&nbsp;</div>
							</div>
						</template>
					</div>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import * as corpusStore from '@/store/corpus';
import {snippetParts} from '@/utils';

import * as bls from '@/modules/singlepage-bls';

export default Vue.extend({
	props: {
		results: Object as () => BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults,
		sort: String as () => null|string,
		type: String as () => 'hits'|'docs',
	},
	data: () => ({
		concordances: {} as {
			[key: string]: {
				available: number;
				request: null|Promise<BLTypes.BlHitResults|BLTypes.BLDocResults>;
				open: boolean;
				// TODO
				concordances: Array<{ left: string; hit: string; right: string; }|{ title: string; hits: number; }>;
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
		firstMainAnnotation: corpusStore.get.firstMainAnnotation,
		textDirection: corpusStore.get.textDirection,
	},
	methods: {
		width(group: BLTypes.GroupResult): string {
			return Math.ceil(group.size / this.results.summary.largestGroupSize * 100) + '%';
		},
		openPreviewConcordances(id: string) {
			const cache = this.concordances[id] = this.concordances[id] || {
				open: false,
				available: Number.MAX_SAFE_INTEGER,
				concordances: [],
				request: null,
			}

			cache.open = !cache.open;
			if (cache.open && cache.request == null && cache.concordances.length === 0) {
				this.loadPreviewConcordances(id);
			}
		},
		loadPreviewConcordances(id: string) {
			const cache = this.concordances[id];

			if (cache.request || cache.available! <= cache.concordances.length) {
				return;
			}

			// TODO this is probably incorrect, the results could be stale while we're waiting for a new set in the parent.
			// make a copy!
			let requestParameters: BLTypes.BlacklabParameters = Object.assign({}, this.results.summary.searchParam, {
				number: 20,
				first: cache.concordances.length,
				viewgroup: id,
				sample: undefined,
				samplenum: undefined,
				sampleseed: undefined,
				wordsaroundhit: undefined,
				sort: undefined,
			} as BLTypes.BlacklabParameters)

			cache.request = new Promise<BLTypes.BlHitResults|BLTypes.BLDocResults>((resolve, reject) => {
				bls.search(this.type, requestParameters, (res: BLTypes.BlHitResults|BLTypes.BLDocResults) => resolve(res), reject);
			})
			.then(res => {
				if (this.type === 'hits') {
					const data = res as BLTypes.BlHitResults;
					cache.available = data.summary.numberOfHitsRetrieved;
					data.hits.forEach(hit => {
						const parts = snippetParts(hit, this.firstMainAnnotation.id);
						cache.concordances.push({
							left: this.textDirection==='ltr'? parts[0] : parts[2],
							right: this.textDirection==='ltr'? parts[2] : parts[0],
							hit: parts[1]
						})
					})
				} else {
					const data = res as BLTypes.BLDocResults;
					cache.available = data.summary.numberOfDocsRetrieved;

					data.docs.forEach(doc => {
						cache.concordances.push({
							title: doc.docInfo[data.summary.docFields.titleField],
							hits: doc.numberOfHits!,
						})
					})
				}
				return res;
			})
			.catch<never>(err => {
				// TODO log error somewhere in component.
				throw err;
			})
			.finally(() => cache.request = null)
		},

		/** EVENTS **/
		openFullConcordances(id: string, displayName: string) {
			this.$emit('viewgroup', {id, displayName});
		},
		changeSort(payload: string) {
			this.$emit('sort', payload === this.sort ? '-'+payload : payload)
		},
	},
	watch: {
		results: {
			immediate: true,
			handler(newVal: BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults) {
				const newConcordances = {} as any;
				(BLTypes.isHitGroups(newVal) ? newVal.hitGroups : newVal.docGroups).forEach(group => {
					newConcordances[group.identity] = null;
				})
				this.concordances = newConcordances;
			}
 		}
	}
});

</script>

<style lang="scss">

</style>

