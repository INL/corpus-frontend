<template>
	<tr class="concordance">
		<td colspan="10">
			<div class="well-light">
				<div class="concordance-controls clearfix">
					<button type="button" class="btn btn-sm btn-primary open-concordances" :disabled="disabled" @click="$emit('openFullConcordances')"><span class="fa fa-angle-double-left"></span> {{$t('results.table.viewDetailedConcordances')}}</button>
					<button type="button" v-if="!concordances.done" :disabled="concordances.loading" class="btn btn-sm btn-default" @click="concordances.next()">
						<template v-if="concordances.loading">
							<span class="fa fa-spin fa-spinner"></span> {{$t('results.table.loading')}}
						</template>
						<template v-else>{{$t('results.table.loadMoreConcordances')}}</template>
					</button>

					<button type="button" class="close close-concordances" title="close" @click="$emit('close')"><span>&times;</span></button>
				</div>

				<div v-if="concordances.error != null" class="text-danger" v-html="concordances.error"></div>

				<HitsTable v-if="type === 'hits' && concordances.results.length"
					:data="concordances.results"
			        :annotatedField="annotatedField"
					:mainAnnotation="mainAnnotation"
					:dir="dir"
					:html="html"
				/>
				<DocsTable v-else-if="type === 'docs' && concordances.results.length"
					:mainAnnotation="mainAnnotation"
					:metadata="metadata"
					:dir="dir"
					:html="html"
					:data="concordances.results"
				/>
				<div class="concordance-controls clearfix" v-if="concordances.results.length > 10">
					<button type="button" class="btn btn-sm btn-primary open-concordances" :disabled="disabled" @click="$emit('openFullConcordances')"><span class="fa fa-angle-double-left"></span> {{$t('results.table.viewDetailedConcordances')}}</button>
					<button type="button" v-if="!concordances.done" :disabled="concordances.loading" class="btn btn-sm btn-default" @click="concordances.next()">
						<template v-if="concordances.loading">
							<span class="fa fa-spin fa-spinner"></span> {{$t('results.table.loading')}}
						</template>
						<template v-else>{{$t('results.table.loadMoreConcordances')}}</template>
					</button>

					<button type="button" class="close close-concordances" :title="$t('results.table.close')" @click="$emit('close')"><span>&times;</span></button>
				</div>

			</div>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import frac2Percent from '@/mixins/fractionalToPercent';
import PaginatedGetter from '@/pages/search/results/table/ConcordanceGetter';
import {blacklab} from '@/api';
import { BLSearchParameters, BLHitResults, BLDocResults } from '@/types/blacklabtypes';

import HitsTable, {HitRowData} from '@/pages/search/results/table/HitsTable.vue'
import DocsTable, {DocRowData} from '@/pages/search/results/table/DocsTable.vue';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { GroupRowData } from '@/pages/search/results/table/GroupTable.vue';

import * as UIStore from '@/store/search/ui';
import * as CorpusStore from '@/store/search/corpus';
import { getDocumentUrl } from '@/utils';
import { getHighlightColors, snippetParts } from '@/utils/hit-highlighting';


export default Vue.extend({
	components: {
		HitsTable, DocsTable
	},
	props: {
		query: Object as () => BLSearchParameters,
		type: String as () => 'hits'|'docs',
		data: Object as () => GroupRowData,

		/** The field that was searched (for parallel corpora queries, the source field) */
		annotatedField: {
			type: String,
			default: '',
		},
		mainAnnotation: Object as () => NormalizedAnnotation,
		otherAnnotations: Array as () => NormalizedAnnotation[]|undefined,
		metadata: Array as () => NormalizedMetadataField[]|undefined,

		dir: String as () => 'ltr'|'rtl',
		html: Boolean,
		disabled: Boolean,
		open: Boolean
	},
	data: () => ({
		concordances: null as any as PaginatedGetter<HitRowData|DocRowData>,
	}),
	methods: {
		frac2Percent
	},
	created() {
		const getDocumentSummary = UIStore.getState().results.shared.getDocumentSummary;
		const fieldInfo = CorpusStore.getState().corpus!.fieldInfo;

		this.concordances = new PaginatedGetter<HitRowData|DocRowData>((first, number) => {
			// make a copy of the parameters so we don't clear them for all components using the summary
			const requestParameters: BLSearchParameters = Object.assign({}, this.query, {
				// Do not clear sample/samplenum/samplecount,
				// or we could retrieve concordances that weren't included in the input results for the grouping
				number,
				first,
				viewgroup: this.data.id,
				sort: undefined,
			} as BLSearchParameters);

			if (this.type === 'hits') {
				let {request, cancel} = blacklab.getHits(INDEX_ID, requestParameters);
				return {
					cancel,
					request: request.then((r: BLHitResults) => r.hits.map<HitRowData>(h => {
						const colors = getHighlightColors(r.summary);
						return {
							type: 'hit',
							hit: h,
							context: snippetParts(h, this.mainAnnotation.id, this.dir, colors),
							doc: {
								docInfo: r.docInfos[h.docPid],
								docPid: h.docPid,
							},
							gloss_fields: [],
							hit_first_word_id: '',
							hit_id: '',
							hit_last_word_id: '',
						}
					}))
				}
			} else {
				let {request, cancel} = blacklab.getDocs(INDEX_ID, requestParameters);
				return {
					cancel,
					request: request.then((r: BLDocResults) => r.docs.map<DocRowData>(doc => ({
						type: 'doc',
						doc,
						href: getDocumentUrl(doc.docPid, this.query.patt || undefined, this.query.pattgapdata || undefined),
						summary: getDocumentSummary(doc.docInfo, fieldInfo)
					})))
				}
			}
		}, this.data.size)
	},
	watch: {
		open() {
			if (this.open && !this.concordances.done) this.concordances.next();
		}
	}
});
</script>

<style lang="scss" scoped>
</style>