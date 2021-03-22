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
							{{specialMetaDisplayNames[meta.id] || meta.displayName}} <Debug>(id: {{meta.id}})</Debug>
						</a>
					</th>
					<th v-if="hasHits"><a role="button" @click="changeSort(`numhits`)" :class="['sort', {'disabled': disabled}]" title="Sort by number of hits">Hits</a></th>
				</tr>
			</thead>
			<tbody>
				<template v-for="(rowData, index) in rows">
					<tr class="rounded"
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
							<a class="doctitle" target="_blank" :href="rowData.href">{{rowData.summary}}</a>
						</td>
						<td v-for="meta in shownMetadataCols" :key="meta.id">{{(rowData.doc.docInfo[meta.id] || []).join(', ')}}</td>
						<td v-if="hasHits">{{rowData.hits}}</td>
					</tr>
					<tr v-if="showDocumentHits" :key="index + '_hits'" class="hit-details"><td colspan="600">
						<div class="clearfix" style="border-bottom:1px solid #ddd;">
							<div class="col-xs-5 text-right"><strong>{{leftLabel}}</strong></div>
							<div class="col-xs-2 text-center" style="padding: 0;"><strong>Hit</strong></div>
							<div class="col-xs-5"><strong>{{rightLabel}}</strong></div>
						</div>
						<div v-for="(conc, index) in rowData.snippets" :key="index" class="clearfix concordance" :dir="textDirection">
							<template v-if="concordanceAsHtml">
								<div class="col-xs-5 text-right" v-html="conc.left"></div>
								<div class="col-xs-2 text-center"><strong v-html="conc.hit"></strong></div>
								<div class="col-xs-5" v-html="conc.right"></div>
							</template>
							<template v-else>
								<div class="col-xs-5 text-right">&hellip; {{conc.left}}</div>
								<div class="col-xs-2 text-center"><strong>{{conc.hit}}&nbsp;</strong></div>
								<div class="col-xs-5">{{conc.right}} &hellip;</div>
							</template>
						</div>
						<div class="text-muted clearfix col-xs-12" v-if="hasHits && rowData.hits > rowData.snippets.length">...({{rowData.hits - rowData.snippets.length}} more hidden hits)</div>
					</td></tr>
				</template>
			</tbody>
		</table>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';

import { snippetParts, getDocumentUrl } from '@/utils';
import { BLDocResults, BLDocFields, BLHitSnippet, BLDocInfo } from '@/types/blacklabtypes';
import { NormalizedMetadataField } from '@/types/apptypes';

type DocRow = {
	snippets: Array<{
		left: string;
		hit: string;
		right: string;
	}>
	/** Title + year + author of the document */
	summary: string;
	/** Url to open the article view */
	href: string;
	// date: string;
	hits?: number;
	docPid: string;
	doc: BLDocResults['docs'][number];
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
		concordanceAnnotationId(): string { return UIStore.getState().results.shared.concordanceAnnotationId; },
		concordanceAsHtml(): boolean { return UIStore.getState().results.shared.concordanceAsHtml; },
		transformSnippets(): null|((s?: BLHitSnippet|BLHitSnippet[]) => void) { return UIStore.getState().results.shared.transformSnippets; },
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
			.map(id => CorpusStore.getState().metadataFields[id]);
		},
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
		rows(): DocRow[] {
			const docFields = this.results.summary.docFields;

			return this.results.docs.map(doc => {
				const { docPid: pid, docInfo: info } = doc;

				return {
					snippets: doc.snippets ? doc.snippets.map(s => {
						if (this.transformSnippets) {
							this.transformSnippets(s);
						}
						const snippet = snippetParts(s, this.concordanceAnnotationId);
						return {
							left: snippet[this.leftIndex],
							hit: snippet[1],
							right: snippet[this.rightIndex]
						};
					}) : [],
					summary: this.getDocumentSummary(info, docFields),
					href: getDocumentUrl(pid, this.results.summary.searchParam.patt || undefined, this.results.summary.searchParam.pattgapdata || undefined),
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