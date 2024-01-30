<template>
	<div>

		<div class="crumbs-totals">
			<slot name="breadcrumbs"/>
			<slot name="totals"/>
		</div>

		<slot name="groupBy"/>
		<slot name="pagination"/>

		<table class="hits-table">
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
					<tr v-if="rowData.type === 'doc'" class="document rounded"
						v-show="showTitles"
						:key="index"
						v-tooltip.top-start="{
							show: pinnedTooltip === index,
							content: `Document id: ${rowData.docPid}`,
							trigger: pinnedTooltip === index ? 'manual' : 'hover',
							targetClasses: pinnedTooltip === index ? 'pinned' : undefined,
							hideOnTargetClick: false,
							autoHide: false,
						}"

						@click="pinnedTooltip = (pinnedTooltip === index ? null : index)"
					>
						<td :colspan="numColumns">
							<a class="doctitle" target="_blank" :href="rowData.href">{{rowData.summary}}</a>
						</td>
					</tr>
					<template v-else-if="rowData.type === 'hit'">
						<tr :key="index" :class="['concordance', 'rounded interactable', {'open': citations[index] && citations[index].open}]" @click="showCitation(index)">
							<template v-if="concordanceAsHtml">
								<td class="text-right">&hellip;<span :dir="textDirection" v-html="rowData.left"></span></td>
								<td class="text-center"><strong :dir="textDirection" v-html="rowData.hit"></strong></td>
								<td><span :dir="textDirection" v-html="rowData.right"></span>&hellip;</td>
							</template>
							<template v-else>
								<td class="text-right">&hellip;<span :dir="textDirection">{{rowData.left}}</span></td>
								<td class="text-center"><strong :dir="textDirection">{{rowData.hit}}</strong></td>
								<td><span :dir="textDirection">{{rowData.right}}</span>&hellip;</td>
							</template>
							<td v-for="(v, index) in rowData.other" :key="index">{{v}}</td>
							<td v-for="field in rowData.gloss_fields" :key="field.fieldName" style="overflow: visible;">
								<GlossField
									:fieldName="field.fieldName"
									:hit_first_word_id="rowData.hit_first_word_id"
									:hit_last_word_id="rowData.hit_last_word_id"
									:fieldDescription="field"
									:hitId="rowData.hit_id"
								/>
							</td>
							<td v-for="meta in shownMetadataCols" :key="meta.id">{{rowData.doc[meta.id] ? rowData.doc[meta.id].join(', ') : ''}}</td>
						</tr>
						<tr v-if="citations[index]" v-show="citations[index].open" :key="index + '-citation'" :class="['concordance-details', {'open': citations[index].open}]">
							<td :colspan="numColumns">
								<DepTree :hitRowJson="JSON.stringify(rowData)" :index="index + ''"></DepTree>
								<p v-if="citations[index].error" class="text-danger">
									<span class="fa fa-exclamation-triangle"></span> <span v-html="citations[index].error"></span>
								</p>
								<p v-else-if="citations[index].citation">
									<template v-for="addon in citations[index].addons">
										<component v-if="addon.component"
											:is="addon.component"
											:key="addon.name"
											:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
											v-bind="addon.props"
											v-on="addon.listeners"
										>
											<div v-if="addon.content" v-html="addon.content"></div>
										</component>

										<component v-else
											:is="addon.element || 'div'"
											:key="addon.name"
											:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
											v-bind="addon.props"
											v-on="addon.listeners"
											v-html="addon.content"
										/>

									</template>

									<span :dir="textDirection">
										<template v-if="concordanceAsHtml">
											<span v-html="citations[index].citation.left"></span>
											<strong v-html="citations[index].citation.hit"></strong>
											<a :href="citations[index].href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
											<span v-html="citations[index].citation.right"></span>
										</template>
										<template v-else>
											<span>{{citations[index].citation.left}}</span>
											<strong>{{citations[index].citation.hit}}</strong>
											<a :href="citations[index].href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
											<span>{{citations[index].citation.right}}</span>
										</template>
									</span>
								</p>
								<p v-else>
									<span class="fa fa-spinner fa-spin"></span> Loading...
								</p>
								<div v-if="shownConcordanceAnnotationRows.length" style="overflow: auto; max-width: 100%; padding-bottom: 15px;">
									<table class="concordance-details-table">
										<thead>
											<tr>
												<th>Property</th>
												<th :colspan="rowData.props.punct.length">Value</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="annot in shownConcordanceAnnotationRows" :key="annot.id">
												<th>{{annot.displayName}}</th>
												<td v-for="(v, index) in rowData.props[annot.id]" :key="index">{{v}}</td>
											</tr>
										</tbody>
									</table>
								</div>
							</td>
						</tr>
					</template>
				</template>
			</tbody>
		</table>

		<hr>

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
import { snippetParts, words, getDocumentUrl } from '@/utils';
import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import {debugLog} from '@/utils/debug';

import GlossField from '@/pages/search//form/concept/GlossField.vue' // Jesse

import {ReactiveDepTree} from "@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js";
import DepTree from "@/pages/search/results/table/DepTree.vue"
import { stripIndent } from 'common-tags';

export type HitRow = {
	type: 'hit';
	left: string;
	hit: string;
	right: string;
	other: string[];
	props: BLTypes.BLHitSnippetPart;

	// For requesting snippets
	docPid: string;
	start: number;
	end: number;
	doc: BLTypes.BLDocInfo;

	gloss_fields: GlossModule.GlossFieldDescription[];
	hit_first_word_id: string; // Jesse
	hit_last_word_id: string // jesse
	hit_id: string; // jesse

	/** Not every hit has matches */
	matchInfos?: BLTypes.BLMatchInfos;
};

type DocRow = {
	type: 'doc';
	summary: string;
	href: string;
	docPid: string;
};

type CitationData = {
	open: boolean;
	loading: boolean;
	citation: null|{
		left: string;
		hit: string;
		right: string;
	};
	error?: null|string;
	snippet: null|BLTypes.BLHitSnippet;
	addons: Array<ReturnType<UIStore.ModuleRootState['results']['hits']['addons'][number]>> // todo give type a name and export separately
	href: string;
};



export default Vue.extend({
	components: {
	 	GlossField,
		ReactiveDepTree,
		DepTree
	},
	props: {
		results: Object as () => BLTypes.BLHitResults,
		sort: String as () => string|null,
		// showTitles: Boolean as () => boolean,
		disabled: Boolean
	},
	data: () => ({
		citations: {} as {
			[key: number]: CitationData;
		},
		pinnedTooltip: null as null|number,
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
			return this.rows.filter((r): r is HitRow => r.type === 'hit').map(r => r.hit_id)
		},
		rows(): Array<DocRow|HitRow> {
			const docFields = this.results.summary.docFields;
			const infos = this.results.docInfos;

			let prevPid: string;
			return this.results.hits.flatMap(hit => {
				const rows = [] as Array<DocRow|HitRow>;

				// Render a row for this hit's document, if this hit occurred in a different document than the previous
				const pid = hit.docPid;
				if (pid !== prevPid) {
					prevPid = pid;
					const doc = infos[pid];
					// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
					// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
					// Have a configurable url in the backend that's made available on the client that we can use here.
					rows.push({
						type: 'doc',
						summary: this.getDocumentSummary(doc, docFields),
						href: getDocumentUrl(pid, this.results.summary.searchParam.patt || undefined, this.results.summary.searchParam.pattgapdata || undefined, hit.start, UIStore.getState().results.shared.pageSize),
						docPid: pid,
					}  as DocRow);
				}

				// And display the hit itself
				if (this.transformSnippets) {
					this.transformSnippets(hit);
				}
				const parts = snippetParts(hit, this.concordanceAnnotationId);

				// ids of the hit, if gloss module is enabled.
				const {startid: hit_first_word_id = '', endid: hit_last_word_id = ''} = GlossModule.get.settings()?.get_hit_range_id(hit) ?? {startid: '', endid: ''};
				const hit_id = GlossModule.get.settings()?.get_hit_id(hit) ?? '';

				// TODO condense this data..
				rows.push({
					type: 'hit',
					left: parts[this.leftIndex],
					hit: parts[1],
					right: parts[this.rightIndex],
					props: hit.match,
					other: this.shownAnnotationCols.map(annot => words(hit.match, annot.id, false, '')),
					docPid: hit.docPid,
					start: hit.start,
					end: hit.end,
					doc: infos[pid],

					gloss_fields: GlossModule.get.gloss_fields(),
					hit_first_word_id,
					hit_last_word_id,
					hit_id,

					matchInfos: hit.matchInfos,
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
		showCitation(index: number /*row: HitRow*/) {
			if (this.citations[index] != null) {
				this.citations[index].open = !this.citations[index].open;
				return;
			}

			const row = this.rows[index] as HitRow;
			const citation: CitationData = Vue.set(this.citations, index, {
				open: true,
				loading: true,
				citation: null,
				error: null,
				snippet: null,
				href: getDocumentUrl(
					row.docPid,
					this.results.summary.searchParam.patt || undefined,
					this.results.summary.searchParam.pattgapdata || undefined,
					row.start,
					UIStore.getState().results.shared.pageSize,
					row.start),
			} as CitationData);

			ga('send', 'event', 'results', 'snippet/load', row.docPid);

			Api.blacklab
			.getSnippet(INDEX_ID, row.docPid, row.start, row.end, this.concordanceSize)
			.then(s => {
				if (this.transformSnippets) {
					this.transformSnippets(s);
				}
				const snippet = snippetParts(s, this.concordanceAnnotationId);
				citation.citation = {
					left: snippet[this.leftIndex],
					hit: snippet[1],
					right: snippet[this.rightIndex]
				};
				citation.snippet = s;
				// Run plugins defined for this corpora (ex. a copy citation to clipboard button, or an audio player/text to speech button)
				citation.addons = UIStore.getState().results.hits.addons
					.map(a => a({
						snippet: s,
						docId: row.docPid,
						corpus: INDEX_ID,
						document: this.results.docInfos[row.docPid],
						documentUrl: citation.href,
						wordAnnotationId: this.concordanceAnnotationId,
						dir: this.textDirection,
						citation: citation.citation!
					}))
					.filter(a => a != null);
			})
			.catch((err: AppTypes.ApiError) => {
				citation.error = UIStore.getState().global.errorMessage(err, 'snippet');
				debugLog(err.stack);
				ga('send', 'exception', { exDescription: err.message, exFatal: false });
			})
			.finally(() => citation.loading = false);
		},

		// {"type":"relation","relType":"dep::case","sourceStart":163,"sourceEnd":164,"targetStart":161,"targetEnd":162,"start":161,"end":164}
		toConllu(row: HitRow, index: number, onlyMatchedRelations: boolean) : string {
			const canned = stripIndent`
				# text = I am eating a pineapple
				1	I	_	PRON	_	_	2	suj	_	_
				2	am	_	AUX	_	_	0	root	_	_
				3	eating	_	VERB	_	_	2	aux	_	highlight=red
				4	a	_	DET	_	_	5	det	_	_
				5	pineapple	_	NOUN	_	_	3	obj	_	_
			`
			const word = row.props.word
			const rel = row.props.deprel
			const wordnum = row.props.wordnum
			const lemma = row.props.lemma
			const pos = row.props.pos
			const xpos = row.props.xpos
			const start: number = +wordnum[0]
			//console.log(JSON.stringify(row.matchInfos))
			//console.log(row.start)
			interface x  { [key: number]: string }
			const foundRels : x =  {}
			const foundHeads : x = {}
			if (('matchInfos' in row) && (row.matchInfos != null)) {
				Object.values(row.matchInfos).map(v => {
					if (v.type == 'relation') {
						const rel = v.relType.replace("dep::","")
						const wordnum = v.targetStart - row.start + 1
						const headnum = v.sourceStart - row.start + 1
						foundRels[wordnum] = rel
						foundHeads[headnum]  = rel
					}
				})
			}

			const dinges = /* `# sent_id = s${index}` + "\n" + */ '# text = ' + word.join(" ") + "\n" +
				row.props.head.map((h, i) =>
						{
						const relIsMatched = i+1 in foundRels
						const headIsMatched = i+1 in foundHeads
						const headInHit = wordnum.includes(h)
						const showRel = headInHit // && (relIsMatched)

						const h1 = showRel?  +h -start + 1: '_';
						const rel1 = showRel? rel[i] : '_';
						const misc = (relIsMatched||headIsMatched)?  'highlight=red' : '_';
						return '    ' + Array(+wordnum[i] - start + 1, word[i], lemma[i], pos[i], xpos[i], '_', h1, rel1, '_', misc).join("\t")
					}).join("\n")
			//console.log('matched targets:' + JSON.stringify(foundRels))
			//console.log('matched sources:' + JSON.stringify(foundHeads))
			//console.log(dinges)
			return dinges;
		}
	},
	watch: {
		results(n: BLTypes.BLHitResults, o: BLTypes.BLHitResults) {
			this.citations = {};
			this.pinnedTooltip = null;
		},
	}
});
</script>


<!-- gruwelijk, Jesse -->
<style lang="css">
.capture {
	border-style: solid;
	border-color: goldenrod;
}

.capture_0 {
	color: blue;
}

.capture_1 {
	color: red
}
.capture_2 {
	color: green
}

.capture_3 {
	color: purple
}

.capture_4 {
	color: orange
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
