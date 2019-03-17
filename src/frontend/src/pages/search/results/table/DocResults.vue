<template>
	<div>
		<slot name="groupBy"/>
		<slot name="pagination"/>

		<table class="docs-table">
			<thead>
				<tr>
					<th style="width:70%"><a role="button" @click="changeSort(`field:${results.summary.docFields.titleField}`)" :class="['sort', {'disabled': disabled}]" title="Sort by document title">Document title</a></th>
					<th style="width:15%"><a role="button" @click="changeSort(`field:${results.summary.docFields.dateField}`)" :class="['sort', {'disabled': disabled}]" title="Sort by document year">Year</a></th>
					<th v-if="hasHits" style="width:15%"><a role="button" @click="changeSort(`numhits`)" :class="['sort', {'disabled': disabled}]" title="Sort by number of hits">Hits</a></th>
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
					<td>{{rowData.date}}</td>
					<td v-if="hasHits">{{rowData.hits}}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';

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
	docPid: string;
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
	tr:hover {
		background: #eee;
	}
}

</style>