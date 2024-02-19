<template>
	<tr class="concordance rounded interactable">

		<!-- <pre>{{ context }}</pre> -->
		<HitContextComponent tag="td" class="text-right" :dir="dir" :data="context.before" :html="html"/>
		<HitContextComponent tag="td" class="text-center" :dir="dir" :data="context.match" :html="html"/>
		<HitContextComponent tag="td" class="" :dir="dir" :data="context.after" :html="html"/>


		<!-- <template v-if="html">
			<td class="text-right">&hellip;<span :dir="dir" v-html="data.left"></span></td>
			<td class="text-center"><strong :dir="dir" v-html="data.hit"></strong></td>
			<td><span :dir="dir" v-html="data.right"></span>&hellip;</td>
		</template>
		<template v-else>
			<td class="text-right">&hellip;<span :dir="dir">{{data.left}}</span></td>
			<td class="text-center"><strong :dir="dir">{{data.hit}}</strong></td>
			<td><span :dir="dir">{{data.right}}</span>&hellip;</td>
		</template> -->
		<HitContextComponent v-for="(c, i) in otherContexts" tag="td" :data="c.match" :html="html" :dir="dir" :key="i"/>

		<!-- <td v-for="a in otherAnnotations" :key="a + data.hit">{{v}}</td> -->
		<td v-for="field in data.gloss_fields" :key="field.fieldName" style="overflow: visible;">
			<GlossField
				:fieldName="field.fieldName"
				:hit_first_word_id="data.hit_first_word_id"
				:hit_last_word_id="data.hit_last_word_id"
				:fieldDescription="field"
				:hitId="data.hit_id"
			/>
		</td>
		<td v-for="meta in metadata" :key="meta">{{data.doc[meta] ? data.doc[meta].join(', ') : ''}}</td>
	</tr>

</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import GlossField from '@/pages/search/form/concept/GlossField.vue';
import { GlossFieldDescription } from '@/store/search/form/glossStore';
import { HitContext, NormalizedAnnotation } from '@/types/apptypes';
import { snippetParts } from '@/utils';

import HitContextComponent from './HitContext.vue';

export type HitRowData = {
	type: 'hit';
	hit: BLTypes.BLHit;


	// left: string;
	// hit: string;
	// right: string;

	// other: string[];
	// props: BLTypes.BLHitSnippetPart;

	// For requesting snippets
	// docPid: string;
	// start: number;
	// end: number;
	doc: BLTypes.BLDocInfo;

	// TODO jesse
	gloss_fields: GlossFieldDescription[];
	hit_first_word_id: string; // Jesse
	hit_last_word_id: string // jesse
	hit_id: string; // jesse

	/** Not every hit has matches */
	// matchInfos?: BLTypes.BLHit['matchInfos'];
};


export default Vue.extend({
	components: {
		GlossField,
		HitContextComponent
	},
	props: {
		data: Object as () => HitRowData,
		mainAnnotation: String,
		otherAnnotations: Array as () => NormalizedAnnotation[],
		metadata: Array as () => string[],
		dir: String as () => 'ltr'|'rtl',
		html: Boolean,
	},
	computed: {
		context(): HitContext {
			return snippetParts(this.data.hit, this.mainAnnotation, this.dir) || [];
		},
		otherContexts(): HitContext[] {
			return this.otherAnnotations.map(a => snippetParts(this.data.hit, a.id, this.dir) || []);
		}
	},

});
</script>

