<template>
	<div>
		<slot name="groupBy"/>
		<slot name="pagination"/>

		<table class="docs-table">
			<thead>
				<tr class="rounded">
					<th><a role="button" @click="changeSort(`field:${results.summary.docFields.titleField}`)" :class="['sort', {'disabled': disabled}]" title="Sort by document title">Document</a></th>
					<th v-for="meta in shownMetadataCols" :key="meta.id">
						<a role="button" @click="changeSort(`field:${meta.id}`)" :class="['sort', {'disabled': disabled}]" :title="`Sort by ${specialMetaDisplayNames[meta.id] || meta.displayName}`">
							{{specialMetaDisplayNames[meta.id] || meta.displayName}}
						</a>
					</th>
					<th v-if="hasHits"><a role="button" @click="changeSort(`numhits`)" :class="['sort', {'disabled': disabled}]" title="Sort by number of hits">Hits</a></th>
				</tr>
			</thead>
			<tbody>
				<tr class="rounded"
					v-for="(rowData, index) in rows"
					v-tooltip="{
						show: pinnedTooltip === index,
						content: `Document id: ${rowData.docPid}`,
						trigger: pinnedTooltip === index ? 'manual' : 'hover',
						targetClasses: pinnedTooltip === index ? 'pinned' : undefined,
						hideOnTargetClick: false,
						autoHide: false,
					}"

					:key="index"

					@click="pinnedTooltip = (pinnedTooltip === index ? null : index)"
				>
					<td>
						<a target="_blank" :href="rowData.href">{{rowData.summary}}</a><br>
						<div v-if="showDocumentHits" v-for="(snippet, index) in rowData.snippets" :dir="textDirection" :key="index">
							{{snippet.left}} <strong :key="index">{{snippet.hit}}</strong> {{snippet.right}}
						</div>
					</td>
					<!-- <td>{{rowData.date}}</td> -->
					<td v-for="meta in shownMetadataCols" :key="meta.id">{{rowData.doc.docInfo[meta.id]}}</td>
					<td v-if="hasHits">{{rowData.hits}}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';

import { snippetParts, getDocumentUrl } from '@/utils';
import { BLDocResults, BLDocInfo, BLDocFields } from '@/types/blacklabtypes';
import { NormalizedMetadataField } from '@/types/apptypes';

type DocRow = {
	snippets: Array<{
		before: string;
		hit: string;
		after: string;
	}>
	/** Title + year + author of the document */
	summary: string;
	/** Url to open the article view */
	href: string;
	date: string;
	hits?: number;
	docPid: string;
	doc: BLDocInfo;
};

export default Vue.extend({
	props: {
		results: Object as () => BLDocResults,
		sort: String as () => null|string,
		showDocumentHits: Boolean,
		disabled: Boolean
	},
	data: () => ({
		pinnedTooltip: null as null|number,
	}),
	computed: {
		mainAnnotation: CorpusStore.get.firstMainAnnotation,
		textDirection: CorpusStore.get.textDirection,
		shownMetadataCols(): NormalizedMetadataField[] { return UIStore.getState().results.docs.shownMetadataIds.map(id => CorpusStore.getState().metadataFields[id]); },
		specialMetaDisplayNames(): { [id: string]: string; } {
			const specialFields = CorpusStore.getState().fieldInfo;
			const ret: {[id: string]: string} = {};
			Object.entries(specialFields).forEach(([type, fieldId]) => { switch (type as keyof BLDocFields) {
				case 'authorField': ret[fieldId!] = 'Author'; break;
				case 'dateField': ret[fieldId!] = 'Date'; break;
				case 'pidField': ret[fieldId!] = 'ID'; break;
				case 'titleField': ret[fieldId!] = 'Title'; break;
			}});

			return ret;
		},
		rows() {
			const { titleField, dateField, authorField } = this.results.summary.docFields;
			return this.results.docs.map(doc => {
				const { docPid: pid, docInfo: info } = doc;

				return {
					snippets: doc.snippets ? doc.snippets.map(s => {
						const [before, hit, after] = snippetParts(s, this.mainAnnotation.id);
						return {
							before,
							hit,
							after
						};
					}) : [],
					summary: (info[titleField!] || 'UNKNOWN') + (info[authorField!] ? ' by ' + info[authorField!] : ''),
					href: getDocumentUrl(pid, this.results.summary.searchParam.patt),
					date: info[dateField!] || '',
					hits: doc.numberOfHits,
					docPid: pid,
					doc
				};
			});
		},
		hasHits(): boolean {
			return this.results.docs.length > 0 && this.results.docs[0].numberOfHits != null;
		}
	},
	methods: {
		changeSort(payload: string) {
			if (!this.disabled) {
				this.$emit('sort', payload === this.sort ? '-'+payload : payload);
			}
		},
	},

	watch: {
		results: {
			handler() {
				this.pinnedTooltip = null;
			}
		}
	}
});
</script>

<style lang="scss">

.docs-table {
	table-layout: auto;

	> thead > tr > th,
	> tbody > tr > td,
	> tbody > tr > th {
		&:first-child { padding-left: 6px; }
		&:last-child { padding-right: 6px; }
	}


	tr:hover {
		background: #eee;
	}
}

</style>