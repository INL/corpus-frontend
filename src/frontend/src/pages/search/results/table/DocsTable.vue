<template>
	<table class="docs-table">
		<thead>
			<tr class="rounded">
				<th><a role="button" @click="changeSort(`field:${specialFields.titleField}`)" :class="['sort', {'disabled': disabled}]" title="Sort by document title">Document</a></th>
				<th v-for="meta in metadata" :key="meta.id">
					<a role="button" @click="changeSort(`field:${meta.id}`)" :class="['sort', {'disabled': disabled}]" :title="`Sort by ${specialMetaDisplayNames[meta.id] || meta.displayName}`">
						{{specialMetaDisplayNames[meta.id] || meta.displayName}} <Debug>(id: {{meta.id}})</Debug>
					</a>
				</th>
				<th v-if="hasHits"><a role="button" @click="changeSort(`numhits`)" :class="['sort', {'disabled': disabled}]" title="Sort by number of hits">Hits</a></th>
			</tr>
		</thead>
		<tbody>
			<template v-for="(rowData, index) in data">
				<DocRow :key="index"
					:data="rowData"
					:metadata="metadata"
				/>
				<tr v-if="showHits && rowData.doc.snippets" :key="index + '-hits'">
					<td colspan="100">
						<HitsTable
							:data="hitRowsForDoc(rowData)"
							:mainAnnotation="mainAnnotation"
							:dir="dir"
							:html="html"
							:disabled="true"
							:disableDetails="true"
						/>
						<div class="text-muted clearfix col-xs-12" v-if="hiddenHits(rowData)">...({{hiddenHits(rowData)}} more hidden hits)</div>
					</td>
				</tr>
			</template>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { BLDocFields } from '@/types/blacklabtypes';

import HitsTable, {HitRowData} from '@/pages/search/results/table/HitsTable.vue';
import DocRow, {DocRowData} from '@/pages/search/results/table/DocRow.vue';

export {DocRowData} from '@/pages/search/results/table/DocRow.vue';
export {HitRowData} from '@/pages/search/results/table/HitsTable.vue';

export default Vue.extend({
	components: {HitsTable, DocRow},
	props: {
		mainAnnotation: Object as () => NormalizedAnnotation,
		metadata: Array as () => NormalizedMetadataField[]|undefined,
		dir: String as () => 'ltr'|'rtl',
		html: Boolean,
		disabled: Boolean,

		showHits: Boolean,

		data: Array as () => DocRowData[]
	},
computed: {
		hasHits(): boolean { return this.data[0]?.doc.numberOfHits != null; },
		specialFields(): BLDocFields { return CorpusStore.getState().corpus!.fieldInfo; },
		specialMetaDisplayNames(): { [id: string]: string; } {
			const specialFields = this.specialFields
			const ret: {[id: string]: string} = {};
			Object.entries(specialFields).forEach(([type, fieldId]) => { switch (type as keyof BLDocFields) {
				case 'authorField': ret[fieldId!] = 'Author'; break;
				case 'dateField': ret[fieldId!] = 'Date'; break;
				case 'pidField': ret[fieldId!] = 'ID'; break;
				case 'titleField': ret[fieldId!] = 'Title'; break;
			}});

			return ret;
		},
	},
	methods: {
		changeSort(sort: string) {
			this.$emit('changeSort', sort)
		},
		hitRowsForDoc(docRow: DocRowData): HitRowData[] {
			return docRow.doc.snippets!.map(s => ({
				type: 'hit',
				hit: s,
				doc: docRow.doc,
				gloss_fields: [],
				hit_first_word_id: '',
				hit_id: '',
				hit_last_word_id: '',
			}))
		},
		hiddenHits(docRow: DocRowData): number {
			return (docRow.doc.numberOfHits || 0) - (docRow.doc.snippets?.length || 0);
		}
	}

})
</script>