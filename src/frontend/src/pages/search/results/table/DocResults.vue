<template>
	<div>
		<div class="crumbs-totals">
			<slot name="breadcrumbs"/>
			<slot name="totals"/>
		</div>

		<slot name="groupBy"/>
		<slot name="pagination"/>

		<table class="docs-table">
			<thead>
				<tr class="rounded">
					<th><a role="button" @click="changeSort(`field:${results.summary.docFields.titleField}`)" :class="['sort', {'disabled': disabled}]" title="Sort by document title">Document</a></th>
					<th v-for="meta in shownMetadataCols" :key="meta.id">
						<a role="button" @click="changeSort(`field:${meta.id}`)" :class="['sort', {'disabled': disabled}]" :title="`Sort by ${specialMetaDisplayNames[meta.id] || meta.displayName}`">
							{{specialMetaDisplayNames[meta.id] || meta.displayName}} <Debug>(id: {{meta.id}})</Debug>
						</a>
					</th>
					<th v-if="hasHits"><a role="button" @click="changeSort(`numhits`)" :class="['sort', {'disabled': disabled}]" title="Sort by number of hits">Hits</a></th>
				</tr>
			</thead>
			<tbody>
				<template v-for="(rowData, index) in rows">
					<DocRowComponent
						:data="rowData"
						:metadata="shownMetadataCols"
					/>
					<DocRowHitsComponent v-if="showDocumentHits"
						:data="rowData"
						:annotation="concordanceAnnotationId"
						:dir="textDirection"
						:html="concordanceAsHtml"
					/>
				</template>
			</tbody>
		</table>

		<hr>
		<div class="text-right">
			<slot name="sort"/>
			<button v-if="resultsHaveHits"
				type="button"
				class="btn btn-primary btn-sm"

				@click="showDocumentHits = !showDocumentHits"
			>
				{{showDocumentHits ? 'Hide Hits' : 'Show Hits'}}
			</button>
			<slot name="export"/>
		</div>

	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';

import { getDocumentUrl } from '@/utils';
import { BLDocResults, BLDocFields, BLHitSnippet, BLDocInfo } from '@/types/blacklabtypes';
import { NormalizedMetadataField } from '@/types/apptypes';

import DocRowComponent, {DocRowData} from './DocRow.vue';
import DocRowHitsComponent from './DocRowHits.vue';

export default Vue.extend({
	components: {
		DocRowComponent,
		DocRowHitsComponent,
	},
	props: {
		results: Object as () => BLDocResults,
		sort: String as () => null|string,
		disabled: Boolean
	},
	data: () => ({
		pinnedTooltip: null as null|number,
		showDocumentHits: false
	}),
	computed: {
		resultsHaveHits(): boolean { return !!this.results?.summary.searchParam.patt;},

		concordanceAnnotationId(): string { return UIStore.getState().results.shared.concordanceAnnotationId; },
		concordanceAsHtml(): boolean { return UIStore.getState().results.shared.concordanceAsHtml; },
		transformSnippets(): null|((s: BLHitSnippet) => void) { return UIStore.getState().results.shared.transformSnippets; },
		getDocumentSummary(): ((doc: BLDocInfo, fields: BLDocFields) => string) { return UIStore.getState().results.shared.getDocumentSummary; },

		textDirection: CorpusStore.get.textDirection,
		leftIndex(): number { return this.textDirection === 'ltr' ? 0 : 2; },
		rightIndex(): number { return this.textDirection === 'ltr' ? 2 : 0; },
		leftLabel(): string { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel(): string { return this.textDirection === 'ltr' ? 'After' : 'Before'; },

		shownMetadataCols(): NormalizedMetadataField[] {
			const sortMetadataFieldMatch = this.sort && this.sort.match(/^-?field:(.+)$/);
			const sortMetadataField = sortMetadataFieldMatch ? sortMetadataFieldMatch[1] : undefined;

			const colsToShow = UIStore.getState().results.docs.shownMetadataIds;
			return (sortMetadataField && !colsToShow.includes(sortMetadataField) ? colsToShow.concat(sortMetadataField) : colsToShow)
			.map(id => CorpusStore.get.allMetadataFieldsMap()[id]);
		},
		specialMetaDisplayNames(): { [id: string]: string; } {
			const specialFields = CorpusStore.getState().corpus!.fieldInfo;
			const ret: {[id: string]: string} = {};
			Object.entries(specialFields).forEach(([type, fieldId]) => { switch (type as keyof BLDocFields) {
				case 'authorField': ret[fieldId!] = 'Author'; break;
				case 'dateField': ret[fieldId!] = 'Date'; break;
				case 'pidField': ret[fieldId!] = 'ID'; break;
				case 'titleField': ret[fieldId!] = 'Title'; break;
			}});

			return ret;
		},
		rows(): DocRowData[] {
			const docFields = this.results.summary.docFields;

			return this.results.docs.map(doc => {
				const { docPid: pid, docInfo: info } = doc;

				return {
					doc,
					href: getDocumentUrl(pid, this.results.summary.searchParam.patt || undefined, this.results.summary.searchParam.pattgapdata || undefined),
					summary: this.getDocumentSummary(info, docFields),
					type: 'doc'

					// snippets: doc.snippets ? doc.snippets.map(s => {
					// 	if (this.transformSnippets) {
					// 		this.transformSnippets(s);
					// 	}
					// 	const snippet = snippetParts(s, this.concordanceAnnotationId);
					// 	return {
					// 		left: snippet[this.leftIndex],
					// 		hit: snippet[1],
					// 		right: snippet[this.rightIndex]
					// 	};
					// }) : [],
					// summary: this.getDocumentSummary(info, docFields),
					// href: getDocumentUrl(pid, this.results.summary.searchParam.patt || undefined, this.results.summary.searchParam.pattgapdata || undefined),
					// hits: doc.numberOfHits,
					// docPid: pid,
					// doc
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
	},
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


	tr.docrow:not(.hit-details):hover {
		background: #eee;
	}
}

.doclink {
	// Make line clickable when links wraps onto next line.
	display: inline-block;
}

</style>