<template>
	<div>

		<div class="crumbs-totals">
			<slot name="breadcrumbs"/>
			<slot name="totals"/>
		</div>

		<slot name="groupBy"/>
		<slot name="pagination"/>

		<pre v-if="results">{{ {...results.hits[0], left: undefined, right: undefined, match: undefined} }}</pre>

		<!-- <table class="hits-table">
			<thead>
				<tr class="rounded">
					<th class="text-right">
						<span v-if="sortableAnnotations.length" class="dropdown">
							<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
								{{leftLabel}} hit
								<span class="caret"/>
							</a>

							<ul class="dropdown-menu" role="menu">
								<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
									<a @click="changeSort(`${beforeField}:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
								</li>
							</ul>
						</span>
						<template v-else>{{leftLabel}} hit</template>
					</th>

					<th class="text-center">
						<span v-if="sortableAnnotations.length" class="dropdown">
							<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
								Hit
								<span class="caret"/>
							</a>

							<ul class="dropdown-menu" role="menu">
								<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
									<a @click="changeSort(`hit:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
								</li>
							</ul>
						</span>
						<template v-else>Hit</template>
					</th>

					<th class="text-left">
						<span v-if="sortableAnnotations.length" class="dropdown">
							<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
								{{rightLabel}} hit
								<span class="caret"/>
							</a>

							<ul class="dropdown-menu" role="menu">
								<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
									<a @click="changeSort(`${afterField}:${annotation.id}`)" :class="['sort', {'disabled':disabled}]" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
								</li>
							</ul>
						</span>
						<template v-else>{{rightLabel}} hit</template>
					</th>
					<th v-for="annotation in shownAnnotationCols" :key="annotation.id">
						<a v-if="annotation.hasForwardIndex"
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`Sort by ${annotation.displayName}`"
							@click="changeSort(`hit:${annotation.id}`)"
						>
							{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug>
						</a>
						<template v-else>{{annotation.displayName}}</template>
					</th>
					<th v-for="meta in shownMetadataCols" :key="meta.id">
						<a
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`Sort by ${meta.displayName}`"
							@click="changeSort(`field:${meta.id}`)"
						>
							{{meta.displayName}} <Debug>(id: {{meta.id}})</Debug>
						</a>
					</th>
					<th v-for="(fieldName, i) in shownGlossCols" :key="i"><a class='sort gloss_field_heading' :title="`User gloss field: ${fieldName}`">{{ fieldName }}</a></th>
				</tr>
			</thead>

			<tbody>
				<template v-for="(rowData, index) in rows">
					<DocRowComponent v-if="rowData.type === 'doc' && showTitles"
						:key="index"
						:data="rowData"
						:colspan="numColumns"
					/>
					<template v-else-if="rowData.type === 'hit'">
						<HitRowComponent
							:key="index"
							:class="{open: citations[index] && citations[index].open}"

							:data="rowData"
							:mainAnnotation="concordanceAnnotationId"
							:otherAnnotations="shownAnnotationCols"
							:html="concordanceAsHtml"
							:metadata="shownMetadataCols"

							@click.native="showCitation(index)"
						/>
						<HitContextRowComponent v-if="citations[index] && citations[index].open"
							:key="index + '-citation'"
							:class="['concordance-details', {'open': citations[index].open}]"

							:data="citations[index]"
							:html="concordanceAsHtml"
							:colspan="numColumns"
							:dir="textDirection"
							:mainAnnotation="concordanceAnnotationId"
							:otherAnnotations="shownConcordanceAnnotationRows"
						/>
					</template>


				</template>
			</tbody>
		</table> -->
		<HitsTable
			:query="results.summary.searchParam"
			:mainAnnotation="mainAnnotation"
			:otherAnnotations="shownAnnotationCols"
			:metadata="shownMetadataCols"
			:sortableAnnotations="sortableAnnotations"
			:dir="textDirection"
			:html="concordanceAsHtml"
			:disabled="disabled"
			:data="rows"
		/>


		<hr>

		<slot name="pagination"/>

		<div class="text-right">
			<slot name="sort"/>
			<button
				type="button"
				class="btn btn-primary btn-sm"

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
import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import {debugLog, show} from '@/utils/debug';

import GlossField from '@/pages/search//form/concept/GlossField.vue' // Jesse

//@ts-ignore
// import {ReactiveDepTree} from "@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js";
// import DepTree from "@/pages/search/results/table/DepTree.vue"

// import HitRowComponent, {HitRowData} from './HitRow.vue';
import {DocRowData} from './newtable/DocRow.vue';
// import HitContextRowComponent, {CitationRowData} from './HitContextRow.vue';

import HitsTable, {HitRowData} from './newtable/HitsTable.vue';

export default Vue.extend({
	components: {
	 	GlossField,
		// ReactiveDepTree,
		// DepTree,
		// HitRowComponent,
		// HitContextRowComponent,
		// DocRowComponent,
		HitsTable
	},
	props: {
		results: Object as () => BLTypes.BLHitResults,
		sort: String as () => string|null,
		// showTitles: Boolean as () => boolean,
		disabled: Boolean
	},
	data: () => ({
		// citations: {} as {
		// 	[key: number]: CitationRowData;
		// },
		// pinnedTooltip: null as null|number,
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
		shownConcordanceAnnotationRows(): AppTypes.NormalizedAnnotation[] {
			let configuredIds = UIStore.getState().results.shared.detailedAnnotationIds;
			if (!configuredIds || !configuredIds.length) {
				configuredIds = CorpusStore.get.annotationGroups().flatMap(g => g.isRemainderGroup ? [] : g.entries)
			}

			const annots = CorpusStore.get.allAnnotationsMap();
			const configuredAnnotations = configuredIds.map(id => annots[id]);
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
		// showCitation(index: number /*row: HitRow*/) {
		// 	debugger;
		// 	if (this.citations[index]) {
		// 		this.citations[index].open = !this.citations[index].open;
		// 		return;
		// 	}

		// 	const row = this.rows[index] as HitRowData;
		// 	const citation: CitationRowData = Vue.set(this.citations, index, {
		// 		open: true,
		// 		loading: true,
		// 		citation: null,
		// 		error: null,
		// 		hit: this.results.hits[index],
		// 		href: getDocumentUrl(
		// 			row.hit.docPid,
		// 			this.results.summary.searchParam.patt || undefined,
		// 			this.results.summary.searchParam.pattgapdata || undefined,
		// 			row.hit.start,
		// 			UIStore.getState().results.shared.pageSize,
		// 			row.hit.start),
		// 		addons: []
		// 	});

		// 	ga('send', 'event', 'results', 'snippet/load', row.hit.docPid);

		// 	Api.blacklab
		// 	.getSnippet(INDEX_ID, row.hit.docPid, row.hit.start, row.hit.end, this.concordanceSize)
		// 	.then(s => {
		// 		if (this.transformSnippets) {
		// 			this.transformSnippets(s);
		// 		}
		// 		citation.citation = s;
		// 		// Run plugins defined for this corpus (ex. a copy citation to clipboard button, or an audio player/text to speech button)
		// 		citation.addons = UIStore.getState().results.hits.addons
		// 			.map(a => a({
		// 				docId: row.hit.docPid,
		// 				corpus: INDEX_ID,
		// 				document: this.results.docInfos[row.hit.docPid],
		// 				documentUrl: citation.href,
		// 				wordAnnotationId: this.concordanceAnnotationId,
		// 				dir: this.textDirection,
		// 				citation: citation.citation!
		// 			}))
		// 			.filter(a => a != null);
		// 	})
		// 	.catch((err: AppTypes.ApiError) => {
		// 		citation.error = UIStore.getState().global.errorMessage(err, 'snippet');
		// 		debugLog(err.stack);
		// 		ga('send', 'exception', { exDescription: err.message, exFatal: false });
		// 	})
		// 	.finally(() => citation.loading = false);
		// },
	},
	watch: {
		// results(n: BLTypes.BLHitResults, o: BLTypes.BLHitResults) {
		// 	this.citations = {};
		// 	// this.pinnedTooltip = null;
		// },
	}
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
