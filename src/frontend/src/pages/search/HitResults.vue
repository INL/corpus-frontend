<template>
	<table>
		<thead>
			<tr>
				<th class="text-right" style="width:40px">
					<span class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown">
							{{leftLabel}} hit
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in annotations" :key="annotation.id">
								<a @click="changeSort(`left:${annotation.id}`)" class="sort">{{annotation.displayName}}</a>
							</li>
						</ul>
					</span>
				</th>

				<th class="text-center" style="width:20px;">
					<a @click="changeSort(`hit:${firstMainAnnotation.id}`)" class="sort" :title="`Sort by ${firstMainAnnotation.displayName}`">
						<strong>{{firstMainAnnotation.displayName}}</strong>
					</a>
				</th>

				<th class="text-left" style="width:40px">
					<span class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown">
							{{rightLabel}} hit
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in annotations" :key="annotation.id">
								<a @click="changeSort(`right:${annotation.id}`)" class="sort">{{annotation.displayName}}</a>
							</li>
						</ul>
					</span>
				</th>

				<th v-for="annotation in shownAnnotations" :key="annotation.id" style="width:15px;">
					<a @click="changeSort(`hit:${annotation.id}`)" class="sort" :title="`Sort by ${annotation.displayName}`">{{annotation.displayName}}</a>
				</th>
			</tr>
		</thead>

		<tbody>
			<template v-for="(rowData, index) in rows">
				<tr v-if="rowData.type === 'doc'" v-show="showTitles" :key="index" class="document">
					<td :colspan="numColumns">
						<div class="doctitle">
							<a class="text-error" target="_blank" :href="rowData.href">{{rowData.summary}}</a>
						</div>
					</td>
				</tr>
				<template v-else-if="rowData.type === 'hit'">
					<tr :key="index" :class="['concordance', {'open': citations[index] && citations[index].open}]" @click="showCitation(index)">
						<td class="text-right">&hellip;<span :dir="textDirection">{{rowData.left}}</span></td>
						<td class="text-center"><strong :dir="textDirection">{{rowData.hit}}</strong></td>
						<td><span :dir="textDirection">{{rowData.right}}</span>&hellip;</td>
						<td v-for="(v, index) in rowData.other" :key="index">{{v}}</td>
					</tr>
					<tr v-if="citations[index]" v-show="citations[index].open" :key="index + '-citation'" :class="['concordance-details', {'open': citations[index].open}]">
						<td :colspan="numColumns">
							<p v-if="citations[index].error" class="text-danger">
								{{citations[index].error}}
							</p>
							<p v-else-if="citations[index].citation">
								{{citations[index].citation[leftIndex]}}<strong>{{citations[index].citation[1]}}</strong>{{citations[index].citation[rightIndex]}}
							</p>
							<p v-else>
								Loading...
							</p>
							<table>
								<thead>
									<tr>
										<th v-for="(value, key) in rowData.props" v-if="key !== 'punct'" :key="key">
											{{key}}
										</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="i in rowData.props.punct.length" :key="i">
										<td v-for="(value, key) in rowData.props" v-if="key !== 'punct'" :key="key">
											{{value[i-1]}}
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</template>
			</template>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';

import * as qs from 'qs';

import * as corpusStore from '@/store/corpus';
import { snippetParts, words, getDocumentUrl } from '@/utils';
import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';

import {debugLog} from '@/utils/debug';

declare const BLS_URL: string;

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
}

type DocRow = {
	type: 'doc';
	summary: string;
	href: string;
}

type CitationData = {
	open: boolean;
	loading: boolean;
	citation: null|[string, string, string];
	error?: null|string;
}

export default Vue.extend({
	props: {
		results: Object as () => BLTypes.BlHitResults,
		sort: String as () => string|null,
		showTitles: Boolean as () => boolean,
	},
	data: () => ({
		citations: {} as {
			[key: number]: CitationData;
		}
	}),
	computed: {
		leftIndex() { return this.textDirection === 'ltr' ? 0 : 2 },
		rightIndex() { return this.textDirection === 'ltr' ? 2 : 0 },
		leftLabel() { return this.textDirection === 'ltr' ? 'Before' : 'After' },
		rightLabel() { return this.textDirection === 'ltr' ? 'After' : 'Before' },

		rows(): Array<DocRow|HitRow> {
			const { titleField, dateField, authorField } = this.results.summary.docFields;
			const infos = this.results.docInfos;

			let prevPid: string;
			return this.results.hits.flatMap(hit => {
				const rows = [] as (DocRow|HitRow)[];

				// Render a row for this hit's document, if this hit occurred in a different document than the previous
				const pid = hit.docPid;
				if (pid !== prevPid) {
					prevPid = pid;
					const doc = infos[pid]

					const title = doc[titleField] || 'UNKNOWN';
					const author = doc[authorField] ? ' by ' + doc[authorField] : '';
					const date = doc[dateField] ? ' (' + doc[dateField] + ')' : '';

					// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
					// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
					// Have a configurable url in the backend that's made available on the client that we can use here.

					rows.push({
						type: 'doc',
						summary: title+author+date,
						href: getDocumentUrl(pid, this.results.summary.searchParam.patt)
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
					other: this.shownAnnotations.map(annot => words(hit.match, annot.id, false, '')),
					docPid: hit.docPid,
					start: hit.start,
					end: hit.end
				});

				return rows;
			});
		},
		numColumns() {
			return 3 + this.shownAnnotations.length; // left - hit - right - (one per shown annotation)
		},
		annotations: corpusStore.get.annotations,
		firstMainAnnotation: corpusStore.get.firstMainAnnotation,
		shownAnnotations: corpusStore.get.shownAnnotations,
		textDirection: corpusStore.get.textDirection,
	},
	methods: {
		changeSort(payload: string) {
			this.$emit('sort', payload === this.sort ? '-'+payload : payload)
		},
		showCitation(index: number /*row: HitRow*/) {
			if (this.citations[index] != null) {
				this.citations[index].open = !this.citations[index].open;
				return;
			}

			const citation: CitationData = Vue.set(this.citations as any[], index, { // shut up vue
				open: true,
				loading: true,
				citation: null,
				error: null,
			} as CitationData);

			const row = this.rows[index] as HitRow;

			Api.blacklab
			.getSnippet(corpusStore.getState().id, row.docPid, row.start, row.end)
			.then(s => citation.citation = snippetParts(s, this.firstMainAnnotation.id))
			.catch(e => citation.error = e.message)
			.finally(() => citation.loading = false);
		}
	},
	watch: {
		results() {
			this.citations = {};
		}
	}
});

</script>

<style lang="scss" scoped>

table {
	border-collapse: separate;
}


th, td {
	&:first-child { padding-left: 6px; }
	&:last-child { padding-right: 6px; }
}


td {
	overflow: hidden;
}

tr {
	border-bottom: 1px solid #ffffff;
}

.concordance, .document {
	&:hover {
		background-color: rgba(0,0,0, 0.1);
	}
}

.concordance {
	cursor: pointer;
	> td {
		padding: 0px 5px;
		transition: padding 0.1s;
	}

	&.open {
		> td {
			background: white;
			border-top: 2px solid #ddd;
			border-bottom: 1px solid #ddd;
			padding: 8px 5px;
			&:first-child {
				border-left: 2px solid #ddd;
				border-top-left-radius: 4px;
			}
			&:last-child {
				border-right: 2px solid #ddd;
				border-top-right-radius: 4px;
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

