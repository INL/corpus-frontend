<template>
	<table>
		<thead>
			<tr>
				<th style="width:30%;"><a @click="changeSort('identity')" class="sort" title="Sort by group name">Group</a></th>
				<th style="width:70%;"><a @click="changeSort('numhits')" class="sort" title="Sort by group size">{{type === 'hits' ? 'Hits' : 'Documents'}}</a></th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="({identity, identityDisplay, size}) in groups" :key="identity" :class="['grouprow', { 'open': concordances[identity] && concordances[identity].open }]">
				<td>{{identityDisplay || '[unknown]'}}</td>
				<td>
					<div class="progress group-size-indicator" @click="openPreviewConcordances(identity)">
						<div class="progress-bar progress-bar-primary" :style="[{'min-width': width(size)}]">{{size}} {{relativeSize(size)}}</div>
					</div>

					<!-- todo spinner, disable loading more, etc -->
					<div v-if="concordances[identity] && concordances[identity].open" class="well-light">
						<div>
							<button type="button" class="btn btn-sm btn-link" @click="openFullConcordances(identity, identityDisplay)">&#171; View detailed concordances in this group</button>
							<template v-if="concordances[identity].available > concordances[identity].concordances.length">
								&nbsp;-&nbsp;<button
									type="button"
									class="btn btn-sm btn-link"
									@click="loadPreviewConcordances(identity)"
									:disabled="concordances[identity].request != null"
								>{{`${concordances[identity].request != null ? 'loading...' : 'Load more concordances...'}`}}</button>
							</template>
						</div>

						<template v-if="type === 'hits'">
							<div class="clearfix" style="border-bottom:1px solid #ddd;">
								<div class="col-xs-5 text-right"><strong>{{leftLabel}}</strong></div>
								<div class="col-xs-2 text-center"><strong>Hit</strong></div>
								<div class="col-xs-5"><strong>{{rightLabel}}</strong></div>
							</div>
							<div v-for="(conc, index) in concordances[identity].concordances" :key="index" class="clearfix concordance">
								<div class="col-xs-5 text-right">&hellip; {{conc.left}}</div>
								<div class="col-xs-2 text-center"><strong>{{conc.hit}}&nbsp;</strong></div>
								<div class="col-xs-5">{{conc.right}} &hellip;</div>
							</div>
						</template>
						<template v-else>
							<table>
								<thead>
									<tr>
										<th style="width: 80%">Document</th>
										<th style="width: 20%" v-if="concordances[identity].hasHits">Hits</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="(conc, index) in concordances[identity].concordances" :key="index">
										<td><a :href="conc.href" target="_blank">{{conc.title}}</a></td>
										<td v-if="concordances[identity].hasHits"><strong>{{conc.hits}}</strong></td>
									</tr>
								</tbody>
							</table>
						</template>
					</div>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import * as corpusStore from '@/store/corpus';
import * as Api from '@/api';
import {snippetParts, getDocumentUrl} from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

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
				request: null|Promise<BLTypes.BLHitResults|BLTypes.BLDocResults>;
				open: boolean;
				// TODO
				hasHits?: boolean, // only when this.type === docs
				concordances: Array<
					{ // when this.type === hits
						left: string;
						hit: string;
						right: string;
					}|{ // when this.type === docs
						 title: string;
						 hits?: number;
						 href: string;
					}
				>;
			}
		},
		subCorpusStats: null as null|BLTypes.BLDocResults,
		unsub: null as any

	}),
	computed: {
		groups(): BLTypes.BLGroupResult[] {
			return BLTypes.isHitGroups(this.results) ? this.results.hitGroups : this.results.docGroups;
		},
		firstMainAnnotation: corpusStore.get.firstMainAnnotation,
		textDirection: corpusStore.get.textDirection,

		leftLabel() { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel() { return this.textDirection === 'ltr' ? 'After' : 'Before'; },
		leftIndex() { return this.textDirection === 'ltr' ? 0 : 2 },
		rightIndex() { return this.textDirection === 'ltr' ? 2 : 0 },
	},
	methods: {
		width(groupSize: number): string {
			return Math.ceil(groupSize / this.results.summary.largestGroupSize * 100) + '%';
		},
		openPreviewConcordances(id: string) {
			const cache = this.concordances[id] = this.concordances[id] || {
				open: false,
				available: Number.MAX_SAFE_INTEGER,
				concordances: [],
				request: null,
				hasHits: this.type === 'docs' ? false : undefined,
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

			// TODO this is incorrect, the results could be stale while we're waiting for a new set of results in the parent.
			// What can happen is that we place the stale result in the cache for the new set of results and it will be displayed...

			// make a copy of the parameters so we don't clear them for all components using the summary
			const requestParameters: BLTypes.BLSearchParameters = Object.assign({}, this.results.summary.searchParam, {
				number: 20,
				first: cache.concordances.length,
				viewgroup: id,
				sample: undefined,
				samplenum: undefined,
				sampleseed: undefined,
				wordsaroundhit: undefined,
				sort: undefined,
			} as BLTypes.BLSearchParameters)

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			const req: Promise<BLTypes.BLSearchResult> = apiCall(corpusStore.getState().id, requestParameters).request;

			req.then(res => {
				if (this.type === 'hits') {
					const data = res as BLTypes.BLHitResults;
					cache.available = data.summary.numberOfHitsRetrieved;
					data.hits.forEach(hit => {
						const parts = snippetParts(hit, this.firstMainAnnotation.id);
						cache.concordances.push({
							left: parts[this.leftIndex],
							hit: parts[1],
							right: parts[this.rightIndex],
						})
					})
				} else {
					const data = res as BLTypes.BLDocResults;
					cache.available = data.summary.numberOfDocsRetrieved;
					cache.hasHits = cache.hasHits || (data.docs.length > 0 && data.docs[0].numberOfHits != null);

					data.docs.forEach(doc => {
						cache.hasHits = cache.hasHits || doc.numberOfHits != null;
						cache.concordances.push({
							title: doc.docInfo[data.summary.docFields.titleField],
							hits: doc.numberOfHits,
							href: getDocumentUrl(doc.docPid, data.summary.searchParam.patt),
						})
					})
				}
			})
			.catch(err => {throw err}) // TODO log error somewhere in component.
			.finally(() => cache.request = null)
		},

		// Display stuff for groups
		relativeSize(size: number) {
			const total: number = BLTypes.isHitGroups(this.results) ? this.results.summary.numberOfHits : this.results.summary.numberOfDocs;
			const div = size / total * 100;
			const numDigits = Math.max(1-Math.floor(Math.log(div)/Math.log(10)), 0);

			return `(${div.toFixed(numDigits)}%)`;
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

.grouprow {
	&.open {
		background: none;
	}

	.concordance {
		&:hover {
			background-color: rgba(0,0,0,0.1);
		}
	}
}

.group-size-indicator {
	cursor: pointer;
	margin-bottom: 2px;

	> .progress-bar {
		// Do not shrink smaller than the text inside the bar.
		// Greater widths are set using min-width.
		padding: 0px 2px;
		//width: auto;
		white-space: nowrap;
	}
}

.well-light {
	background: rgba(255,255,255,0.8);
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	box-shadow: inset 0 1px 2px 0px rgba(0,0,0,0.1);
	margin-bottom: 8px;
	padding: 8px
}

</style>

