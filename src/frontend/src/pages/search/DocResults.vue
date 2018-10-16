<template>
	<table>
		<thead>
			<tr>
				<th style="width:70%"><a @click="changeSort(`field:${results.summary.docFields.titleField}`)" class="sort" title="Sort by document title">Document title</a></th>
				<th style="width:15%"><a @click="changeSort(`field:${results.summary.docFields.dateField}`)" class="sort" title="Sort by document year">Year</a></th>
				<th v-if="hasHits" style="width:15%"><a @click="changeSort(`numhits`)" class="sort" title="Sort by number of hits">Hits</a></th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="(rowData, index) in rows" :key="index">
				<td>
					<a target="_blank" :href="rowData.href">{{rowData.summary}}</a><br>
					<div v-if="showDocumentHits" v-for="(snippet, index) in rowData.snippets" :dir="textDirection" :key="index">
						{{snippet.left}} <strong :key="index">{{snippet.hit}}</strong> {{snippet.right}}
					</div>
				</td>
				<td>{{rowData.date}}</td>
				<td v-if="hasHits">{{rowData.hits}}</td>
			</tr>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import * as corpusStore from '@/store/corpus';

import { snippetParts, getDocumentUrl } from '@/utils';
import { BLDocResults } from 'types/blacklabtypes';

type DocRow = {
	snippets: Array<{
		before: string;
		hit: string;
		after: string;
	}>
	summary: string;
	href: string;
	date: string;
	hits?: number;
}

export default Vue.extend({
	props: {
		results: Object as () => BLDocResults,
		sort: String as () => null|string,
		showDocumentHits: Boolean as () => boolean
	},
	computed: {
		mainAnnotation: corpusStore.get.firstMainAnnotation,
		textDirection: corpusStore.get.textDirection,
		rows(): DocRow[] {
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
						}
					}) : [],
					summary: (info[titleField] || 'UNKNOWN') + (info[authorField] ? ' by ' + info[authorField] : ''),
					href: getDocumentUrl(pid, this.results.summary.searchParam.patt),
					date: info[dateField] || '',
					hits: doc.numberOfHits
				};
			})
		},
		hasHits(): boolean {
			return this.results.docs.length > 0 && this.results.docs[0].numberOfHits != null;
		}
	},
	methods: {
		changeSort(payload: string) {
			this.$emit('sort', payload === this.sort ? '-'+payload : payload)
		},
	}
})
</script>

<style lang="scss">

</style>