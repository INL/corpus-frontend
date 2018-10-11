<template>
	<table>
		<thead>
			<tr>
				<th class="text-right" style="width:40px">
					<span class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown">
							{{textDirection==='ltr' ? 'Before hit ' : 'After hit '}}
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in annotations" :key="annotation.id">
								<a @click="changeSort(`left:${annotation.id}`)">{{annotation.displayName}}</a>
							</li>
						</ul>
					</span>
				</th>

				<th class="text-center" style="width:20px;">
					<a @click="changeSort(`hit:${firstMainAnnotation.id}`)">
						<strong>{{firstMainAnnotation.displayName}}</strong>
					</a>
				</th>

				<th class="text-left" style="width:40px">
					<span class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown">
							{{textDirection==='ltr' ? 'After hit ' : 'Before hit '}}
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in annotations" :key="annotation.id">
								<a @click="changeSort(`right:${annotation.id}`)">{{annotation.displayName}}</a>
							</li>
						</ul>
					</span>
				</th>

				<th v-for="annotation in shownAnnotations" :key="annotation.id" style="width:15px;">
					<a @click="changeSort(`hit:${annotation.id}`)">{{annotation.displayName}}</a>
				</th>
			</tr>
		</thead>

		<tbody>
			<template v-for="(rowData, index) in rows">
				<tr v-if="showTitles && rowData.type === 'doc'" :key="index" class="concordance">
					<td :colspan="numColumns">
						<div class="doctitle collapse in">
							<a
								class="text-error"
								target="_blank"
								:href="rowData.href"
							>
								{{rowData.summary}}
							</a>
						</div>
					</td>
				</tr>
				<tr v-else-if="rowData.type === 'hit'" :key="index" class="concordance">
					<td class="text-right">&hellip;<span :dir="textDirection">{{rowData.left}}</span></td>
					<td class="text-center"><strong :dir="textDirection">{{rowData.hit}}</strong></td>
					<td><span :dir="textDirection">{{rowData.right}}</span>&hellip;</td>
					<td v-for="(v, index) in rowData.other" :key="index">{{v}}</td>
				</tr>
			</template>
			<!-- TODO snippet row, properties row -->

			<!-- snippet row
			<tr>
			<td colspan="', numColumns, '" class="inline-concordance"><div class="collapse">Loading...</div></td>',
			<tr>
			-->

			<!-- properties row
			<tr>
				<td colspan="', numColumns, '" class="inline-concordance"><div class="collapse">Loading...</div></td>
			</tr>
			-->
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';

import * as corpusStore from '@/store/corpus';
import { snippetParts, words, getDocumentUrl } from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

type HitRow = {
	type: 'hit';
	left: string;
	hit: string;
	right: string;
	other: string[];
	props: string;
}

type DocRow = {
	type: 'doc';
	summary: string;
	href: string;
}

export default Vue.extend({
	props: {
		results: Object as () => BLTypes.BlHitResults,
		sort: String as () => string|null,
		showTitles: Boolean as () => boolean,
	},
	computed: {
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
				const left = this.textDirection==='ltr'? parts[0] : parts[2];
				const right = this.textDirection==='ltr'? parts[2] : parts[0];
				const propsWord = this.properties(hit.match);

				rows.push({
					type: 'hit',
					left,
					right,
					hit: parts[1],
					props: propsWord,
					other: this.shownAnnotations.map(annot => words(hit.match, annot.id, false, ''))
				} as HitRow);

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
		/** Concat all properties in the context into a large string */
		properties(context: BLTypes.BLHitSnippetPart): string {
			return Object.entries(context)
				.map(([annotation, values]) => [annotation, values.join('')])
				.filter(([annotation, value]) => !!value)
				.map(([annotation, value]) => `${annotation}: ${value}`)
				.join(', ');
		},
	},
});

</script>

<style lang="scss">

</style>

