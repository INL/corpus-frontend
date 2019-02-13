<template>
	<div>
		<SelectPicker
			placeholder="Show as chart..."
			data-class="btn btn-default btn-sm"

			hideEmpty

			:options="chartModeOptions"
			v-model="chartMode"
		/>

		<v-popover offset="5" style="display:inline-block;">
			<a role="button" title="Column meanings"><span class="fa fa-lg fa-question-circle"/></a>

			<template slot="popover">
				<table class="table table-condensed" style="table-layout:auto; max-width:calc(100vw - 75px);width:500px;">
					<tbody>
						<tr v-for="(row, i) in definitions" :key="i">
							<td v-for="(cell, j) in row" :key="j">{{cell}}</td>
						</tr>
					</tbody>
				</table>
			</template>
		</v-popover>

		<table class="group-table">
			<thead>
				<tr>
					<th v-for="col in columns" :key="col.toString()">{{col}}</th>
				</tr>
			</thead>
			<tbody>
				<template v-for="row in rows">
					<tr :key="row.id">
						<td v-for="col in columns" :key="col.toString()">
							<template v-if="typeof col === 'string'">
								<template v-if="col.indexOf('relative') === -1">{{row[col] != null ? row[col] : '[unknown]'}}</template> <!-- HACK! all division keys contain spaces for now, probably pretty slow too -->
								<template v-else>{{row[col] != null ? $options.filters.frac2Percent(row[col]) : '[unknown]'}}</template>
							</template>

							<div v-else class="progress group-size-indicator" @click="openPreviewConcordances(row.id)">
								<div class="progress-bar progress-bar-primary"
									:style="{
										'min-width': row[col[0]] ? $options.filters.frac2Percent(row[col[0]] / maxima[col[0]]) : '100%',
										'opacity': row[col[0]] ? 1 : 0.5
									}">{{row[col[1]] ? row[col[1]].toLocaleString() : '[unknown]'}}</div>
							</div>
						</td>
					</tr>
					<tr :key="`${row.id}-concordances`" v-if="concordances[row.id] && concordances[row.id].open">
						<td colspan="10">
							<div class="well-light">
								<div class="concordance-controls clearfix">
									<button type="button" class="btn btn-sm btn-primary open-concordances" @click="openFullConcordances(row.id, row.displayName)"><span class="fa fa-angle-double-left"></span> View detailed concordances</button>
									<button type="button" v-if="!allConcordancesLoaded(row.id)" :disabled="!canLoadConcordances(row.id)" class="btn btn-sm btn-default" @click="loadPreviewConcordances(row.id)">
										<template v-if="concordances[row.id].request != null">
											<span class="fa fa-spin fa-spinner"></span> Loading...
										</template>
										<template v-else>Load more concordances</template>
									</button>

									<button type="button" class="close close-concordances" title="close" @click="openPreviewConcordances(row.id)"><span>&times;</span></button>
								</div>

								<div v-if="concordances[row.id].error" class="text-danger">{{concordances[row.id].error.title}}<br>{{concordances[row.id].error.message}}</div>

								<template v-if="type === 'hits' && concordances[row.id].concordances.length > 0">
									<div class="clearfix" style="border-bottom:1px solid #ddd;">
										<div class="col-xs-5 text-right"><strong>{{leftLabel}}</strong></div>
										<div class="col-xs-2 text-center" style="padding: 0;"><strong>Hit</strong></div>
										<div class="col-xs-5"><strong>{{rightLabel}}</strong></div>
									</div>
									<div v-for="(conc, index) in concordances[row.id].concordances" :key="index" class="clearfix concordance">
										<div class="col-xs-5 text-right">&hellip; {{conc.left}}</div>
										<div class="col-xs-2 text-center"><strong>{{conc.hit}}&nbsp;</strong></div>
										<div class="col-xs-5">{{conc.right}} &hellip;</div>
									</div>
								</template>
								<template v-else-if="type === 'docs' && concordances[row.id].concordances.length > 0">
									<table>
										<thead>
											<tr>
												<th style="width: 80%">Document</th>
												<th style="width: 20%" v-if="concordances[row.id].hasHits">Hits</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="(conc, index) in concordances[row.id].concordances" :key="index">
												<td><a :href="conc.href" target="_blank">{{conc.title}}</a></td>
												<td v-if="concordances[row.id].hasHits"><strong>{{conc.hits}}</strong></td>
											</tr>
										</tbody>
									</table>
								</template>
							</div>
						</td>
					</tr>
				</template>
			</tbody>
		</table>
	</div>
</template>

<script lang="tsx">
import Vue, {FunctionalComponentOptions} from 'vue';
import {stripIndent} from 'common-tags';

import * as CorpusStore from '@/store/search/corpus';
import * as InterfaceStore from '@/store/search/form/interface';
import {ViewId} from '@/store/search/results';

import * as Api from '@/api';
import {snippetParts, getDocumentUrl} from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

import SelectPicker from '@/components/SelectPicker.vue';
import frac2Percent from '@/mixins/fractionalToPercent';

const definitions = [
	['c',   '[corpus]',            'The entire corpus'],
	['sc',  '[subcorpus]',         'A set of documents within c. Defined by a specific set of metadata.'],
	['gsc', '[grouped subcorpus]', 'A set of documents within sc. Creating by matching a set of metadata against documents in sc.'],
	['r',   '[results]',           'A set of documents within sc. Created by matching a (optional) cql pattern against documents in sc. If no cql is used, r=sc'],
	['gr',  '[grouped results]',   'A set of documents within r. Created by matching a set of metadata against documents in r.'],

	['*.d', '[documents]',         'Number of documents in a collection'],
	['*.t', '[tokens]',            'Number of tokens in a collections'],
	['*.h', '[documents]',         'Number of hits in a collection'],
];

/*
 * All of these groups have the following properties:
 * - documents
 * - tokens
 * - hits (optional, only available in r and gr when a cql pattern was used)
 *
 * We now make a whole lot of stuff available
 */

interface GroupData {
	id: string;
	displayname: string;

	// aggregate results
	'r.d': number;
	'r.t': number;
	'r.h'?: number;         // NOTE: unavailable for queries without cql pattern

	/** Documents in group */
	'gr.d': number;
	/** Tokens in group */
	'gr.t'?: number; // FIXME remove optional flag when Jan implements
	/** Hits in group */
	'gr.h'?: number;        // NOTE: unavailable for queries without cql pattern

	// group within total search space
	'gsc.d'?: number;       // NOTE: might be unknown (in rare cases, 0 is returned for groups where the metadata value is unknown)
	'gsc.t'?: number;       // NOTE: might be unknown (in rare cases, 0 is returned for groups where the metadata value is unknown)

	// total search space
	'sc.d'?: number; // FIXME remove optional flag when Jan implements
	'sc.t'?: number; // FIXME remove optional flag when Jan implements
}

interface RowData extends GroupData {
	// adds to 1 across all groups
	'relative group size [gr.d/r.d]': number;
	'relative group size [gr.t/r.t]'?: number; // FIXME remove option flag when Jan implements
	// adds to 1 across all groups - optional, only when cql pattern available
	'relative group size [gr.h/r.h]'?: number;

	'relative frequency (docs) [gr.d/gsc.d]'?: number; // optional because subcorpus might not be calculatable
	'relative frequency (tokens) [gr.t/gsc.t]'?: number; // optional because subcorpus might not be calculatable
	'relative frequency (hits) [gr.h/gsc.t]'?: number; // optional because subcorpus might not be calculatable and hits are optional

	'average document length [gr.t/gr.d]'?: number;
}

type LocalMaxima = {
	[P in Exclude<keyof RowData, 'id'|'displayname'>]-?: number;
};

type RowKey = keyof RowData;

type TableDef = Array<RowKey|[RowKey, RowKey]>;

const displayModes: {
	hits: {
		metadata: {
			'table': TableDef,
			'docs': TableDef,
			'hits': TableDef,
			'relative docs': TableDef,
			'relative hits': TableDef,
		},
		annotation: {
			'table': TableDef,
			'hits': TableDef,
		},
	},
	docs: {
		metadata: {
			'table': TableDef,
			'docs': TableDef,
			'tokens': TableDef
		}
	}
} = {
	hits: {
		metadata: {
			'table': [
				'displayname',
				'gr.d',
				'gr.h',
				'gsc.d',
				'gsc.t',
				'relative frequency (docs) [gr.d/gsc.d]',
				'relative frequency (hits) [gr.h/gsc.t]',
			],

			'docs': [
				'displayname',
				['relative group size [gr.d/r.d]', 'gr.d'],
				'relative group size [gr.d/r.d]',
			],

			'hits': [
				'displayname',
				['relative group size [gr.h/r.h]', 'gr.t'],
				'relative group size [gr.h/r.h]',
			],

			'relative docs': [
				'displayname',
				['relative frequency (docs) [gr.d/gsc.d]', 'gr.d'],
				'relative frequency (docs) [gr.d/gsc.d]'
			],

			'relative hits': [
				'displayname',
				['relative frequency (hits) [gr.h/gsc.t]', 'gr.h'],
				'relative frequency (hits) [gr.h/gsc.t]'
			],
		},
		annotation: {
			'table': [
				'displayname',
				'gr.h',
				'relative frequency (hits) [gr.h/gsc.t]'
			],
			'hits': [
				'displayname',
				['relative frequency (hits) [gr.h/gsc.t]', 'gr.h'],
				'relative frequency (hits) [gr.h/gsc.t]'
			],
		},
	},
	docs: {
		metadata: {
			'table': [
				'displayname',
				'gr.d',
				'relative frequency (docs) [gr.d/gsc.d]',
				'gr.t',
				'relative frequency (tokens) [gr.t/gsc.t]',
				'average document length [gr.t/gr.d]',
				// TODO clarify, now we can't see amount of hits per group, neither can we see relative frequency of hits against group's subcorpus
				// then again, the user should group hit results for that....
			],
			'docs': [
				'displayname',
				['relative group size [gr.d/r.d]', 'gr.d'],
				'relative group size [gr.d/r.d]'
			],
			'tokens': [
				'displayname',
				['relative frequency (tokens) [gr.t/gsc.t]', 'gr.t'],
				'relative frequency (tokens) [gr.t/gsc.t]'
			],
		}
	}
};

class MaxCounter {
	public values: {[key: string]: number} = {};

	public add(key: string, v?: number) {
		if (v == null || !(typeof v === 'number')) {
			return;
		}
		this.values[key] = Math.max(this.values[key] || 0, v);
	}
}

export default Vue.extend({
	components: { SelectPicker },
	filters: { frac2Percent },
	props: {
		results: Object as () => BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults,
		sort: String as () => null|string,
		type: String as () => ViewId,
	},
	data: () => ({
		concordances: {} as {
			[key: string]: {
				available: number;
				request: null|Promise<BLTypes.BLSearchResult>;
				error: null|Api.ApiError;
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
	}),
	computed: {

		firstMainAnnotation: CorpusStore.get.firstMainAnnotation,
		textDirection: CorpusStore.get.textDirection,

		leftLabel() { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel() { return this.textDirection === 'ltr' ? 'After' : 'Before'; },
		leftIndex() { return this.textDirection === 'ltr' ? 0 : 2; },
		rightIndex() { return this.textDirection === 'ltr' ? 2 : 0; },

		sortModel: {
			get(): string|null { return this.sort; },
			set(v: string|null) { this.$emit('sort', v); }
		},

		groupMode(): 'annotation'|'metadata' {
			// eventually needs a mixed mode for when grouping on metadata + annotation values
			// but we can't detect this from the blacklab response alone since it looks the same as when grouping on metadata only
			const groupMode =
				this.type === 'docs' ? 'metadata' :
				this.results.summary.subcorpusSize ? 'annotation' :
				'metadata';
			return groupMode;
		},

		chartModeOptions() {
			// TODO
			return Object.keys((displayModes as any)[this.type][this.groupMode]);
		},
		chartMode: {
			get(): string { return InterfaceStore.getState().groupDisplayMode[this.type] || this.chartModeOptions[1]; },
			set(v: string) {
				InterfaceStore.actions.groupDisplayMode({
					view: this.type,
					value: v
				});
			}
		},

		definitions(): string[][] {
			return definitions;
		},

		columns(): TableDef {
			return (displayModes as any)[this.type][this.groupMode][this.chartMode];
		},
		rows(): RowData[] { return this.rowsData.rows; },
		maxima(): LocalMaxima { return this.rowsData.maxima; },
		rowsData(): {
			rows: RowData[],
			maxima: LocalMaxima
		} {
			const max = new MaxCounter();

			const stage1: GroupData[] = [];
			if (this.type === 'hits') {
				const {summary, hitGroups} = this.results as BLTypes.BLHitGroupResults;

				// we know the global maximum of this property, so might as well use it.
				max.add('gr.h', summary.largestGroupSize);

				hitGroups.forEach(g => {
					stage1.push({
						id: g.identity || '[unknown]',
						displayname: g.identityDisplay || '[unknown]',

						'r.d': summary.numberOfDocs,
						'r.t': summary.tokensInMatchingDocuments!, // FIXME augment request to make this available
						'r.h': summary.numberOfHits,

						'gr.d': g.numberOfDocs,
						'gr.t': undefined, // TODO wait for jan
						'gr.h': g.size,

						'gsc.d': (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined,
						'gsc.t': (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined,

						'sc.d': summary.subcorpusSize ? summary.subcorpusSize.documents : undefined, // TODO jan might make always available, remove check
						'sc.t': summary.subcorpusSize ? summary.subcorpusSize.tokens : undefined
					});
				});
			} else {
				const {summary, docGroups} = this.results as BLTypes.BLDocGroupResults;

				// we know the global maximum of this property, so might as well use it.
				max.add('gr.d', summary.largestGroupSize);

				docGroups.forEach(g => {
					// both are 0 in some cases, so mind that
					const sdocs = (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined;
					const stokens = (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined;
					const reldocs = g.size / summary.numberOfDocs;
					const reltokens = /*stokens ? g.numberOfTokens / stokens :*/ undefined; // can't really do more with this, we don't have the number of tokens in docs in this group, probably?
					const sreldocs = sdocs ? g.size / sdocs : undefined;
					const sreltokens = stokens ? g.numberOfTokens / stokens : undefined;

					stage1.push({
						id: g.identity || '[unknown]',
						displayname: g.identityDisplay || '[unknown]',

						'r.d': summary.numberOfDocs,
						'r.t': summary.tokensInMatchingDocuments!, // FIXME augment request to make this available
						'r.h': undefined, // summary.numberOfHits, TODO add when jan makes available

						'gr.d': g.size,
						'gr.t': g.numberOfTokens,
						'gr.h': undefined, // g.numberOfHits, TODO add when jan makes available

						'gsc.d': (g.subcorpusSize ? g.subcorpusSize.documents : summary.subcorpusSize!.documents) || undefined,
						'gsc.t': (g.subcorpusSize ? g.subcorpusSize.tokens : summary.subcorpusSize!.tokens) || undefined,

						'sc.d': summary.subcorpusSize ? summary.subcorpusSize.documents : undefined, // TODO jan might make always available, remove null check if/when
						'sc.t': summary.subcorpusSize ? summary.subcorpusSize.tokens : undefined
					});
				});
			}

			const rows = stage1.map<RowData>((row: GroupData) => {
				const r: RowData = {
					...row,
					'relative group size [gr.d/r.d]': row['gr.d'] / row['r.d'],
					'relative group size [gr.t/r.t]': row['gr.t'] ? row['gr.t']! / row['r.t'] : undefined,
					'relative group size [gr.h/r.h]': row['gr.h'] && row['r.h'] ? row['gr.h']! / row['r.h']! : undefined,

					'relative frequency (docs) [gr.d/gsc.d]':   row['gsc.d'] ? row['gr.d'] / row['gsc.d']! : undefined,
					'relative frequency (tokens) [gr.t/gsc.t]': row['gr.t'] && row['gsc.t'] ? row['gr.t']! / row['gsc.t']! : undefined,
					'relative frequency (hits) [gr.h/gsc.t]': row['gr.h'] && row['gsc.t'] ? row['gr.h']! / row['gsc.t']! : undefined,

					'average document length [gr.t/gr.d]': row['gr.t'] ? Math.round(row['gr.t']! / row['gr.d']) : undefined,
				};

				Object.entries(r).forEach(([k, v]) => max.add(k, v));
				return r;
			});

			return {
				rows,
				maxima: max.values as any
			};
		},
	},
	methods: {
		openPreviewConcordances(id: string) {
			const cache = this.concordances[id] = this.concordances[id] || {
				open: false,
				available: Number.MAX_SAFE_INTEGER,
				concordances: [],
				request: null,
				hasHits: this.type === 'docs' ? false : undefined,
			};

			cache.open = !cache.open;
			if (cache.open && cache.request == null && cache.concordances.length === 0) {
				this.loadPreviewConcordances(id);
			}
		},
		canLoadConcordances(id: string) { const conc = this.concordances[id]; return conc && conc.request == null && conc.available > conc.concordances.length; },
		allConcordancesLoaded(id: string) { const conc = this.concordances[id]; return conc && conc.available <= conc.concordances.length; },
		loadPreviewConcordances(id: string) {
			const cache = this.concordances[id];

			if (cache.request || cache.available! <= cache.concordances.length) {
				return;
			}

			// Technically requests could come in after we get a new set of groups to display
			// but it's not an issue, as we tie them to the groupId and the new groups should have new ids.

			// make a copy of the parameters so we don't clear them for all components using the summary
			const requestParameters: BLTypes.BLSearchParameters = Object.assign({}, this.results.summary.searchParam, {
				number: 20,
				first: cache.concordances.length,
				viewgroup: id,
				// Do not clear sample/samplenum/samplecount, or we could retrieve concordances that weren't included in the input results for the grouping
				wordsaroundhit: undefined,
				sort: undefined,
			} as BLTypes.BLSearchParameters);

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			const req: Promise<BLTypes.BLSearchResult> = apiCall(CorpusStore.getState().id, requestParameters).request;
			cache.request = req;
			cache.error = null;

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
						});
					});
				} else {
					const data = res as BLTypes.BLDocResults;
					cache.available = data.summary.numberOfDocsRetrieved;
					cache.hasHits = cache.hasHits || (data.docs.length > 0 && data.docs[0].numberOfHits != null);

					data.docs.forEach(doc => {
						cache.hasHits = cache.hasHits || doc.numberOfHits != null;
						cache.concordances.push({
							title: doc.docInfo[data.summary.docFields.titleField!],
							hits: doc.numberOfHits,
							href: getDocumentUrl(doc.docPid, data.summary.searchParam.patt),
						});
					});
				}
			})
			.catch(err => cache.error = err)
			.finally(() => cache.request = null);
		},

		/* EVENTS */
		openFullConcordances(id: string, displayName: string) {
			this.$emit('viewgroup', {id, displayName});
		},
	},
	watch: {
		results: {
			immediate: true,
			handler(newVal: BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults, oldVal: BLTypes.BLHitGroupResults|BLTypes.BLDocGroupResults) {
				const newConcordances = {} as any;
				// @ts-ignore
				(BLTypes.isHitGroups(newVal) ? newVal.hitGroups : newVal.docGroups).forEach((group: BLTypes.BLGroupResult) => {
					newConcordances[group.identity] = null;
				});
				this.concordances = newConcordances;
			}
		},
		chartModeOptions(v: string[]) {
			if (!v.includes(this.chartMode)) {
				this.chartMode = 'table';
			}
		}
	}
});
</script>

<style lang="scss">

.group-table {
	table-layout: auto;
	th:not(:last-child) {
		vertical-align: top;
		padding-right: 8px;
	};

	td:not(:last-child) {
		padding-right: 8px;
	}
}

// .grouprow {
// 	&.open {
// 		background: none;
// 	}

// 	.concordance {
// 		&:hover {
// 			background-color: rgba(0,0,0,0.1);
// 		}
// 	}

// 	>.td-group-identity {
// 		overflow: hidden;
// 		text-overflow: ellipsis;
// 	}

// 	>.td-group-size {
// 		padding-right: 6px;
// 	}
// }

.group-size-indicator {
	cursor: pointer;
	margin-bottom: 2px;

	background: linear-gradient(to right, hsla(0, 0%, 91%, 1) 40%, white 100%);

	&:hover {
		background: #d8d8d8;
	}

	> .progress-bar {
		background-image: linear-gradient(to right, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0) 250px);
		// Do not shrink smaller than the text inside the bar.
		// Greater widths are set using min-width.
		padding: 0px 2px;
		width: auto;
		white-space: nowrap;
	}
}

.concordance-controls {
	margin-bottom: 8px;
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

