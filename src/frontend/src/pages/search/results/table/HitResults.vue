<template>
	<div>

		<div class="crumbs-totals">
			<slot name="breadcrumbs"/>
			<slot name="totals"/>
		</div>

		<slot name="groupBy"/>
		<slot name="pagination"/>

		<HitsTable
			:query="results.summary.searchParam"
			:annotatedField="results.summary.pattern?.fieldName || ''"
			:mainAnnotation="mainAnnotation"
			:otherAnnotations="shownAnnotationCols"
			:detailedAnnotations="detailedAnnotations"
			:metadata="shownMetadataCols"
			:sortableAnnotations="sortableAnnotations"
			:dir="textDirection"
			:html="concordanceAsHtml"
			:disabled="disabled"
			:data="rows"
		/>

		<hr>


		<div class="bottom-layout">
			<slot name="pagination"/>
			<div class="spacer"></div>

			<slot name="sort"/>
			<button
				type="button"
				class="btn btn-primary btn-sm show-titles"

				@click="showTitles = !showTitles"
			>
				{{showTitles ? 'Hide' : 'Show'}} Titles
			</button>
			<slot name="export"/>
		</div>

		<!-- moved -->
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as GlossModule from '@/store/search/form/glossStore' // Jesse
import * as UIStore from '@/store/search/ui';
import { getDocumentUrl } from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import GlossField from '@/pages/search//form/concept/GlossField.vue' // Jesse

import {DocRowData} from './DocRow.vue';

import HitsTable, {HitRowData} from './HitsTable.vue';

export default Vue.extend({
	components: {
	 	GlossField,
		HitsTable
	},
	props: {
		results: Object as () => BLTypes.BLHitResults,
		sort: String as () => string|null,
		disabled: Boolean
	},
	data: () => ({
		showTitles: true
	}),
	computed: {
		leftIndex(): number { return this.textDirection === 'ltr' ? 0 : 2; },
		rightIndex(): number { return this.textDirection === 'ltr' ? 2 : 0; },
		leftLabel(): string { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel(): string { return this.textDirection === 'ltr' ? 'After' : 'Before'; },
		beforeField(): string { return this.textDirection === 'ltr' ? 'left' : 'right'; },
		afterField(): string { return this.textDirection === 'ltr' ? 'right' : 'left'; },
		currentPageHitsForGlossStore(): string[] {
			return this.rows.filter((r): r is HitRowData => r.type === 'hit').map(r => r.hit_id)
		},
		rows(): Array<DocRowData|HitRowData> {
			const docFields = this.results.summary.docFields;
			const infos = this.results.docInfos;

			let prevPid: string;
			return this.results.hits.flatMap(hit => {
				const rows = [] as Array<DocRowData|HitRowData>;

				// Render a row for this hit's document, if this hit occurred in a different document than the previous
				const pid = hit.docPid;
				const docInfo: BLTypes.BLDocInfo = infos[pid];
				if (pid !== prevPid) {
					prevPid = pid;
					rows.push({
						type: 'doc',
						summary: this.getDocumentSummary(docInfo, docFields),
						href: getDocumentUrl(pid, this.results.summary.searchParam.patt || undefined, this.results.summary.searchParam.pattgapdata || undefined, hit.start, UIStore.getState().results.shared.pageSize),
						// Document Row components expect a complete BLDoc object, whereas all we have is a BlDocInfo object
						// map it to a complete BLDoc object (with all hit data removed, as that's optional, and we don't need it here)
						doc: { docInfo, docPid: pid }
					});
				}

				// And display the hit itself
				if (this.transformSnippets) {
					this.transformSnippets(hit);
				}
				// ids of the hit, if gloss module is enabled.
				const {startid: hit_first_word_id = '', endid: hit_last_word_id = ''} = GlossModule.get.settings()?.get_hit_range_id(hit) ?? {startid: '', endid: ''};
				const hit_id = GlossModule.get.settings()?.get_hit_id(hit) ?? '';

				rows.push({
					type: 'hit',
					doc: {
						docPid: pid,
						docInfo,
					},
					gloss_fields: GlossModule.get.gloss_fields(),
					hit,
					hit_first_word_id,
					hit_id,
					hit_last_word_id
				});

				return rows;
			});
		},
		numColumns(): number {
			return 3 + this.shownAnnotationCols.length + this.shownMetadataCols.length + this.shownGlossCols.length; // left - hit - right - (one per shown annotation) - (one per shown metadata)
		},
		/** Return all annotations shown in the main search form (provided they have a forward index) */
		sortableAnnotations(): AppTypes.NormalizedAnnotation[] { return UIStore.getState().results.shared.sortAnnotationIds.map(id => CorpusStore.get.allAnnotationsMap()[id]); },
		concordanceAnnotationId(): string { return UIStore.getState().results.shared.concordanceAnnotationId; },
		mainAnnotation(): AppTypes.NormalizedAnnotation { return CorpusStore.get.allAnnotationsMap()[this.concordanceAnnotationId]; },
		concordanceSize(): number { return UIStore.getState().results.shared.concordanceSize; },
		concordanceAsHtml(): boolean { return UIStore.getState().results.shared.concordanceAsHtml; },
		shownAnnotationCols(): AppTypes.NormalizedAnnotation[] {
			// Don't bother showing the value when we're sorting on the surrounding context and not the hit itself
			// as the table doesn't support showing data from something else than the hit
			const sortAnnotationMatch = this.sort && this.sort.match(/^-?hit:(.+)$/);
			const sortAnnotationId = sortAnnotationMatch ? sortAnnotationMatch[1] : undefined;

			const colsToShow = UIStore.getState().results.hits.shownAnnotationIds;
			return (sortAnnotationId && !colsToShow.includes(sortAnnotationId) ? colsToShow.concat(sortAnnotationId) : colsToShow)
			.map(id => CorpusStore.get.allAnnotationsMap()[id]);
		},
		shownMetadataCols(): AppTypes.NormalizedMetadataField[] {
			return UIStore.getState().results.hits.shownMetadataIds
			.map(id => CorpusStore.get.allMetadataFieldsMap()[id]);
		},
		/** Get annotations to show in concordances, if not configured, returns all annotations shown in the main search form. */
		detailedAnnotations(): AppTypes.NormalizedAnnotation[] {
			let configuredIds = UIStore.getState().results.shared.detailedAnnotationIds;
			if (!configuredIds?.length) {
				configuredIds = CorpusStore.get.annotationGroups().flatMap(g => g.isRemainderGroup ? [] : g.entries)
			}

			const annots = CorpusStore.get.allAnnotationsMap();
			const configuredAnnotations = configuredIds.map(id => annots[id]);
			// annotations need a forward index to be able to show values (blacklab can't provide them otherwise)
			return configuredAnnotations.filter(annot => annot.hasForwardIndex);
		},
		shownGlossCols(): string[]  {
			return GlossModule.get.settings()?.gloss_fields.map(f => f.fieldName) ?? []
		},
		textDirection: CorpusStore.get.textDirection,

		transformSnippets(): null|((snippet: BLTypes.BLHitSnippet)=> void){ return UIStore.getState().results.shared.transformSnippets; },
		getDocumentSummary(): ((doc: BLTypes.BLDocInfo, fields: BLTypes.BLDocFields) => any) { return UIStore.getState().results.shared.getDocumentSummary },

	},
	methods: {
		changeSort(payload: string) {
			if (!this.disabled) {
				this.$emit('sort', payload === this.sort ? '-'+payload : payload);
			}
		},
	},
});
</script>


<!-- gruwelijk, Jesse -->
<style lang="css">
.capture {
	border-style: solid;
	border-color: goldenrod;
}

.gloss_field_heading {
	font-style: italic
}
</style>
<style lang="scss" scoped>

.bottom-layout {
	display: flex;
	align-items: center;
	.spacer {
		flex-grow: 1;
	}
	.show-titles {
		margin: 0 0.5em;
	}
}

table {
	> thead > tr > th,
	> tbody > tr > td,
	> tbody > tr > th {
		&:first-child { padding-left: 6px; }
		&:last-child { padding-right: 6px; }
	}

	&.hits-table {
		border-collapse: separate;
		table-layout: auto;
		> tbody > tr {
			border-bottom: 1px solid #ffffff;

			> td {
				overflow: hidden;
				text-overflow: ellipsis;
			}

			&.concordance.open > td {
				overflow: visible;
			}
		}
	}

	&.concordance-details-table {
		table-layout: auto;
	}
}

</style>
