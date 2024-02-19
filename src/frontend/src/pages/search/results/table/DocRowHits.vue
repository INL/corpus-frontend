<template>
	<tr class="hit-details">
		<td colspan="600">
			<div class="clearfix" style="border-bottom:1px solid #ddd;">
				<div class="col-xs-5 text-right"><strong>{{leftLabel}}</strong></div>
				<div class="col-xs-2 text-center" style="padding: 0;"><strong>Hit</strong></div>
				<div class="col-xs-5"><strong>{{rightLabel}}</strong></div>
			</div>
			<div v-for="(h, index) in context" :key="index" class="clearfix concordance" :dir="dir">
				<HitContextComponent tag="div" class="col-xs-5 text-right" :data="h.before" :html="html"/>
				<HitContextComponent tag="div" class="col-xs-5 text-right" :data="h.match" :html="html"/>
				<HitContextComponent tag="div" class="col-xs-5 text-right" :data="h.after" :html="html"/>
			</div>
			<div class="text-muted clearfix col-xs-12" v-if="hiddenHits">...({{hiddenHits}} more hidden hits)</div>
		</td>
	</tr>

</template>

<script lang="ts">
import Vue from 'vue';

import { HitContext } from '@/types/apptypes';
import { BLHitSnippet } from '@/types/blacklabtypes';
import {snippetParts} from '@/utils/index';

import HitContextComponent from '@/pages/search/results/table/HitContext.vue';

import {DocRowData} from './DocRow.vue';


export default Vue.extend({
	components: {
		HitContextComponent,
	},
	props: {
		data: Object as () => DocRowData,
		annotation: String,
		dir: String as () => 'ltr'|'rtl',
		html: Boolean
	},
	computed: {
		hiddenHits(): number {
			return this.data.doc.numberOfHits ? this.data.doc.numberOfHits - this.data.doc.snippets!.length : 0;
		},
		context(): HitContext[] {
			return this.data.doc.snippets?.map((s: BLHitSnippet) => snippetParts(s, this.annotation, this.dir)) || [];
		},
		leftLabel(): string { return this.dir === 'rtl' ? 'Before' : 'After'; },
		rightLabel(): string { return this.dir === 'rtl' ? 'After' : 'Before'; },
	}
});
</script>

