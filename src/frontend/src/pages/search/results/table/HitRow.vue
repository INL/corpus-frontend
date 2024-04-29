<template>
	<tr class="concordance rounded">
		<HitContextComponent tag="td" class="text-right" :dir="dir" :data="context.before" :html="html" before/>
		<HitContextComponent tag="td" bold class="text-center" :dir="dir" :data="context.match" :html="html"/>
		<HitContextComponent tag="td" class="" :dir="dir" :data="context.after" :html="html" after/>

		<HitContextComponent v-for="(c, i) in otherContexts" tag="td" :data="c.match" :html="html" :dir="dir" :key="i"/>

		<td v-for="field in data.gloss_fields" :key="field.fieldName" style="overflow: visible;">
			<GlossField
				:fieldName="field.fieldName"
				:hit_first_word_id="data.hit_first_word_id"
				:hit_last_word_id="data.hit_last_word_id"
				:fieldDescription="field"
				:hitId="data.hit_id"
			/>
		</td>
		<td v-if="data.doc" v-for="meta in metadata" :key="meta.id">{{data.doc.docInfo[meta.id] ? data.doc.docInfo[meta.id].join(', ') : ''}}</td>
	</tr>

</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import GlossField from '@/pages/search/form/concept/GlossField.vue';
import { GlossFieldDescription } from '@/store/search/form/glossStore';
import { HitContext, NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { snippetParts } from '@/utils/hit-highlighting';

import HitContextComponent from '@/pages/search/results/table/HitContext.vue';

/**
 * Can contain either a full hit or a partial hit (without capture/relations info)
 * Partials hits are returned when requesting /docs.
 */
export type HitRowData = {
	type: 'hit';
	doc: BLTypes.BLDoc;
	hit: BLTypes.BLHit|BLTypes.BLHitSnippet;

	// TODO jesse
	gloss_fields: GlossFieldDescription[];
	hit_first_word_id: string; // Jesse
	hit_last_word_id: string // jesse
	hit_id: string; // jesse
};

export default Vue.extend({
	components: {
		GlossField,
		HitContextComponent
	},
	props: {
		data: Object as () => HitRowData,
		mainAnnotation: Object as () => NormalizedAnnotation,
		otherAnnotations: Array as () => NormalizedAnnotation[]|undefined,
		metadata: Array as () => NormalizedMetadataField[]|undefined,
		dir: String as () => 'ltr'|'rtl',
		html: Boolean,
	},
	computed: {
		context(): HitContext {
			if (this.data.hit === undefined) {
				console.error('HitRow: data.hit is undefined', this.data);
			}
			return snippetParts(this.data.hit, this.mainAnnotation.id, this.dir) || [];
		},
		otherContexts(): HitContext[]|undefined {
			return this.otherAnnotations?.map(a => snippetParts(this.data.hit, a.id, this.dir, false));
		},
	},

});
</script>

<style lang="scss">

tr.concordance {
	> td {
		transition: padding 0.1s;
	}

	&.open {
		> td {
			background: white;
			border-top: 2px solid #ddd;
			border-bottom: 1px solid #ddd;
			padding-top: 8px;
			padding-bottom: 8px;
			&:first-child {
				border-left: 2px solid #ddd;
				border-top-left-radius: 4px;
				border-bottom-left-radius: 0;
			}
			&:last-child {
				border-right: 2px solid #ddd;
				border-top-right-radius: 4px;
				border-bottom-right-radius: 0;
			}
		}
	}
	&-details {
		> td {
			background: white;
			border: 2px solid #ddd;
			border-top: none;
			border-radius: 0px 0px 4px 4px;
			padding: 15px 20px;

			> p {
				margin: 0 6px 10px;
			}
		}
	}
}

</style>