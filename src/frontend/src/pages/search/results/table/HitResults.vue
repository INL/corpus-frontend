<template>
	<div>
		<slot name="groupBy"/>
		<slot name="pagination"/>

		<table class="hits-table">
			<thead>
				<tr class="rounded">
					<th class="text-right">
						<span v-if="annotations.filter(a => a.hasForwardIndex).length" class="dropdown">
							<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
								{{leftLabel}} hit
								<span class="caret"/>
							</a>

							<ul class="dropdown-menu" role="menu">
								<li v-for="annotation in annotations.filter(a => a.hasForwardIndex)" :key="annotation.id" :class="{'disabled': disabled}">
									<a @click="changeSort(`${beforeField}:${annotation.id}`)" class="sort">{{annotation.displayName}}</a>
								</li>
							</ul>
						</span>
						<template v-else>{{leftLabel}} hit</template>
					</th>

					<th class="text-center">
						<a v-if="firstMainAnnotation.hasForwardIndex"
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`Sort by ${firstMainAnnotation.displayName}`"
							@click="changeSort(`hit:${firstMainAnnotation.id}`)"
						>
							Hit
						</a>
						<template v-else>Hit</template>
					</th>

					<th class="text-left">
						<span v-if="annotations.filter(a => a.hasForwardIndex).length" class="dropdown">
							<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
								{{rightLabel}} hit
								<span class="caret"/>
							</a>

							<ul class="dropdown-menu" role="menu">
								<li v-for="annotation in annotations.filter(a => a.hasForwardIndex)" :key="annotation.id" :class="{'disabled': disabled}">
									<a @click="changeSort(`${afterField}:${annotation.id}`)" :class="['sort', {'disabled':disabled}]">{{annotation.displayName}}</a>
								</li>
							</ul>
						</span>
						<template v-else>{{rightLabel}} hit</template>
					</th>
					<th v-for="annot in shownAnnotationCols" :key="annot.id">
						<a v-if="annot.hasForwardIndex"
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`Sort by ${annot.displayName}`"
							@click="changeSort(`hit:${annot.id}`)"
						>
							{{annot.displayName}}
						</a>
						<template v-else>{{annot.displayName}}</template>
					</th>
					<th v-for="meta in shownMetadataCols" :key="meta.id">
						<a
							role="button"
							:class="['sort', {'disabled':disabled}]"
							:title="`Sort by ${meta.displayName}`"
							@click="changeSort(`field:${meta.id}`)"
						>
							{{meta.displayName}}
						</a>
					</th>
				</tr>
			</thead>

			<tbody>
				<template v-for="(rowData, index) in rows">
					<tr v-if="rowData.type === 'doc'" class="document rounded"
						v-show="showTitles"
						:key="index"
						v-tooltip="{
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
							<div class="doctitle">
								<a target="_blank" :href="rowData.href">{{rowData.summary}}</a>
							</div>
						</td>
					</tr>
					<template v-else-if="rowData.type === 'hit'">
						<tr :key="index" :class="['concordance', 'rounded interactable', {'open': citations[index] && citations[index].open}]" @click="showCitation(index)">
							<td class="text-right">&hellip;<span :dir="textDirection">{{rowData.left}}</span></td>
							<td class="text-center"><strong :dir="textDirection">{{rowData.hit}}</strong></td>
							<td><span :dir="textDirection">{{rowData.right}}</span>&hellip;</td>
							<td v-for="(v, index) in rowData.other" :key="index">{{v}}</td>
							<td v-for="meta in shownMetadataCols" :key="meta.id">{{rowData.doc[meta.id]}}</td>
						</tr>
						<tr v-if="citations[index]" v-show="citations[index].open" :key="index + '-citation'" :class="['concordance-details', {'open': citations[index].open}]">
							<td :colspan="numColumns">
								<p v-if="citations[index].error" class="text-danger">
									<span class="fa fa-exclamation-triangle"></span> {{citations[index].error}}
								</p>
								<p v-if="citations[index].citation">
									<AudioPlayer v-if="citations[index].audioPlayerData" v-bind="citations[index].audioPlayerData"/>
									<span :dir="textDirection">
										{{citations[index].citation[0]}}
										<strong>
											{{citations[index].citation[1]}}
											<a :href="citations[index].href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
										</strong>
										{{citations[index].citation[2]}}
									</span>
								</p>
								<p v-else>
									<span class="fa fa-spinner fa-spin"></span> Loading...
								</p>
								<div style="overflow: auto; max-width: 100%; padding-bottom: 15px;">
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
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';

import * as qs from 'qs';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import { snippetParts, words, getDocumentUrl } from '@/utils';
import * as Api from '@/api';

import AudioPlayer from '@/components/AudioPlayer.vue';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import {debugLog} from '@/utils/debug';

type HitRow = {
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
	citation: null|[string, string, string];
	error?: null|string;
	snippet: null|BLTypes.BLHitSnippet;
	audioPlayerData: any;
	href: string;
};

export default Vue.extend({
	components: {
		AudioPlayer
	},
	props: {
		results: Object as () => BLTypes.BLHitResults,
		sort: String as () => string|null,
		showTitles: Boolean as () => boolean,
		disabled: Boolean
	},
	data: () => ({
		citations: {} as {
			[key: number]: CitationData;
		},
		pinnedTooltip: null as null|number
	}),
	computed: {
		leftIndex() { return this.textDirection === 'ltr' ? 0 : 2; },
		rightIndex() { return this.textDirection === 'ltr' ? 2 : 0; },
		leftLabel() { return this.textDirection === 'ltr' ? 'Before' : 'After'; },
		rightLabel() { return this.textDirection === 'ltr' ? 'After' : 'Before'; },
		beforeField() { return this.textDirection === 'ltr' ? 'left' : 'right'; },
		afterField() { return this.textDirection === 'ltr' ? 'right' : 'left'; },

		rows(): Array<DocRow|HitRow> {
			const { titleField, dateField, authorField } = this.results.summary.docFields;
			const infos = this.results.docInfos;

			let prevPid: string;
			return this.results.hits.flatMap(hit => {
				const rows = [] as Array<DocRow|HitRow>;

				// Render a row for this hit's document, if this hit occurred in a different document than the previous
				const pid = hit.docPid;
				if (pid !== prevPid) {
					prevPid = pid;
					const doc = infos[pid];

					const title = doc[titleField!] || 'UNKNOWN';
					const author = doc[authorField!] ? ' by ' + doc[authorField!] : '';
					const date = doc[dateField!] ? ' (' + doc[dateField!] + ')' : '';

					// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
					// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
					// Have a configurable url in the backend that's made available on the client that we can use here.

					rows.push({
						type: 'doc',
						summary: title+author+date,
						href: getDocumentUrl(pid, this.results.summary.searchParam.patt || null, this.results.summary.searchParam.pattgapdata || null),
						docPid: pid,
					}  as DocRow);
				}

				// And display the hit itself
				const parts = snippetParts(hit, this.firstMainAnnotation.id);

				// TODO condense this data..
				rows.push({
					type: 'hit',
					left: parts[this.leftIndex],
					right: parts[this.rightIndex],
					hit: parts[1],
					props: hit.match,
					other: this.shownAnnotationCols.map(annot => words(hit.match, annot.id, false, '')),
					docPid: hit.docPid,
					start: hit.start,
					end: hit.end,
					doc: infos[pid]
				});

				return rows;
			});
		},
		numColumns() {
			return 3 + this.shownAnnotationCols.length + this.shownMetadataCols.length; // left - hit - right - (one per shown annotation) - (one per shown metadata)
		},
		annotations: CorpusStore.get.annotations,
		firstMainAnnotation: CorpusStore.get.firstMainAnnotation,
		shownAnnotationCols(): AppTypes.NormalizedAnnotation[] { return UIStore.getState().results.hits.shownAnnotationIds.map(id => CorpusStore.get.annotationsMap()[id][0]); },
		shownMetadataCols(): AppTypes.NormalizedMetadataField[] { return UIStore.getState().results.hits.shownMetadataIds.map(id => CorpusStore.getState().metadataFields[id]); },
		/** Get annotations to show in concordances, if not configured, returns all (non-internal) annotations. */
		shownConcordanceAnnotationRows(): AppTypes.NormalizedAnnotation[] {
			const configured = UIStore.getState().results.shared.detailedAnnotationIds;
			return configured ? configured.map(id => CorpusStore.get.annotationsMap()[id][0]) : CorpusStore.get.annotations();
		},
		textDirection: CorpusStore.get.textDirection,

		corpus() { return CorpusStore.getState().id; },
		getAudioPlayerData() { return UIStore.getState().results.hits.getAudioPlayerData; }
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
			const citation: CitationData = Vue.set(this.citations as any[], index, { // shut up vue
				open: true,
				loading: true,
				citation: null,
				error: null,
				snippet: null,
				href: getDocumentUrl(row.docPid, this.results.summary.searchParam.patt || null, this.results.summary.searchParam.pattgapdata || null, row.start, UIStore.getState().results.shared.pageSize),
			} as CitationData);

			ga('send', 'event', 'results', 'snippet/load', row.docPid);

			Api.blacklab
			.getSnippet(CorpusStore.getState().id, row.docPid, row.start, row.end)
			.then(s => {
				citation.citation = snippetParts(s, this.firstMainAnnotation.id);
				citation.snippet = s;
				citation.audioPlayerData = this.getAudioPlayerData ? this.getAudioPlayerData(this.corpus, row.docPid, s) : null;
			})
			.catch((err: AppTypes.ApiError) => {
				citation.error = err.message;
				debugLog(err.stack);
				ga('send', 'exception', { exDescription: err.message, exFatal: false });
			})
			.finally(() => citation.loading = false);
		}
	},
	watch: {
		results() {
			this.citations = {};
			this.pinnedTooltip = null;
		}
	}
});
</script>

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
				word-break: break-all;
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
