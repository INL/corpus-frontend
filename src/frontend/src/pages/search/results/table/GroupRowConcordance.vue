<template>
	<tr class="concordance" v-if="data.open">
		<td colspan="10">
			<div class="well-light">
				<div class="concordance-controls clearfix">
					<button type="button" class="btn btn-sm btn-primary open-concordances" :disabled="disabled" @click="$emit('openFullConcordances')"><span class="fa fa-angle-double-left"></span> View detailed concordances</button>
					<button type="button" v-if="!concordances.done" :disabled="concordances.loading" class="btn btn-sm btn-default" @click="concordances.next">
						<template v-if="concordances.loading">
							<span class="fa fa-spin fa-spinner"></span> Loading...
						</template>
						<template v-else>Load more concordances</template>
					</button>

					<button type="button" class="close close-concordances" title="close" @click="$emit('close')"><span>&times;</span></button>
				</div>

				<div v-if="concordances.error != null" class="text-danger" v-html="concordances.error"></div>

				<DocRowHitsComponent v-if="type==='hits'"
					:data="concordances.concordances"
					:annotation="annotation"
					:dir="dir"
					:html="html"
				/>
				<DocRowDocsComponent v-else :data="concordances.concordances"/>
			</div>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import frac2Percent from '@/mixins/fractionalToPercent';
import ConcordanceGetter from '@/pages/search/results/table/ConcordanceGetter';
import {blacklab} from '@/api';
import { BLHit, BLDoc, BLSearchParameters, BLHitResults, BLDocResults } from '@/types/blacklabtypes';

import DocRowHitsComponent from '@/pages/search/results/table/DocRowHits.vue';
import DocRowDocsComponent from '@/pages/search/results/table/DocRowDocs.vue';
import { GroupRowdata } from '@/pages/search/results/table/groupTable';

export default Vue.extend({
	components: {
		DocRowHitsComponent,
		DocRowDocsComponent
	},
	props: {
		data: Object as () => GroupRowdata,
		query: Object as () => BLSearchParameters,
		type: String as () => 'hits'|'docs',
		disabled: Boolean,
		annotation: String,
		dir: String as () => 'ltr'|'rtl',
		html: Boolean
	},
	data: () => ({
		concordances: null as any as ConcordanceGetter<BLHit|BLDoc>,
	}),
	computed: {

	},
	methods: {
		frac2Percent
	},
	created() {
		this.concordances = new ConcordanceGetter<BLHit|BLDoc>((first, number) => {
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
				return { cancel, request: request.then((r: BLHitResults) => r.hits) }
			} else {
				let {request, cancel} = blacklab.getDocs(INDEX_ID, requestParameters);
				return { cancel, request: request.then((r: BLDocResults) => r.docs) }
			}
		}, this.data.size)
	}
});
</script>

<style lang="scss" scoped>
</style>