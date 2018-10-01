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
								<a @click="sort(`left:${annotation.id}`)">{{annotation.displayName}}</a>
							</li>
						<ul>
					</span>
				</th>

				<th class="text-center" style="width:20px;">
					<a @click="sort(`hit:${firstMainAnnotation.id}`)">
						<strong>{{firstMainAnnotation.displayName}}<strong>
					</a>
				</th>

				<th class="text-right" style="width:40px">
					<span class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown">
							{{textDirection==='ltr' ? 'After hit ' : 'Before hit '}}
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in annotations" :key="annotation.id">
								<a @click="sort(`right:${annotation.id}`)">{{annotation.displayName}}</a>
							</li>
						<ul>
					</span>
				</th>

				<th v-for="annotation in shownAnnotations" :key="annotation.id" style="width:15px;">
					<a @click="sort(`hit:${annotation.id}`)">{{annotation.displayName}}</a>
				</th>
			</tr>
		</thead>
		<tbody>


			<tr v-for="(rowData, index) in rows" :key="index" class="concordance">
				<template v-if="rowData.type === 'doc'">
					<td :colspan="numColumns">
						<div class="doctitle collapse in">',
							<a
								class="text-error"
								target="_blank"
								:href="rowData.href"
							>
								{{rowData.summary}}
							</a>,
						</div>
					</td>
				</template>
				<template v-else>
					<td class="text-right">&hellip;<span :dir="textDirection">{{rowData.left}}</span></td>
					<td class="text-center"><strong :dir="textDirection">{{rowData.hit}}</strong></td>
					<td><span :dir="textDirection">{{rowData.right}}</span>&hellip;</td>
					<td v-for="(v, index) in rowData.other" :key="index">{{v}}</td>
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

import * as corpusStore from '@/store/corpus';
import * as resultsStore from '@/store/results';
import * as mainStore from '@/store';

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
		view: String as () => 'hits'|'docs'
	},
	data: () => ({

	}),
	computed: {
		rows(): Array<DocRow|HitRow> {
			const data = this.results;

			const textDirection = this.textDirection

			let prevHitDocPid: string;
			return this.results.hits.map(hit => {
				// Render a row for this hit's document, if this hit occurred in a different document than the previous
				const docPid = hit.docPid;
				if (docPid !== prevHitDocPid) {
					prevHitDocPid = docPid;
					const doc = data.docInfos[docPid];
					const docTitle = doc[data.summary.docFields.titleField] || 'UNKNOWN';
					const docAuthor = doc[data.summary.docFields.authorField] ? ' by ' + doc[data.summary.docFields.authorField] : '';
					const docDate = doc[data.summary.docFields.dateField] ? ' (' + doc[data.summary.docFields.dateField] + ')' : '';

					// TODO the clientside url generation story... https://github.com/INL/corpus-frontend/issues/95
					// Ideally use absolute urls everywhere, if the application needs to be proxied, let the proxy server handle it.
					// Have a configurable url in the backend that's made available on the client that we can use here.
					let docUrl;
					switch (new URI().filename()) {
					case '':
						docUrl = new URI('../../docs/');
						break;
					case 'docs':
					case 'hits':
						docUrl = new URI('../docs/');
						break;
					case 'search':
					default: // some weird proxy?
						docUrl = new URI('./docs/');
						break;
					}

					docUrl = docUrl
						.absoluteTo(new URI().toString())
						.filename(docPid)
						.search({
							// parameter 'query' controls the hits that are highlighted in the document when it's opened
							query: data.summary.searchParam.patt
						})
						.toString();

					return {
						type: 'doc',
						summary: docTitle + docAuthor + docDate,
						href: docUrl
					} as DocRow;
				}

				// And display the hit itself
				const parts = this.snippetParts(hit);
				const left = textDirection==='ltr'? parts[0] : parts[2];
				const right = textDirection==='ltr'? parts[2] : parts[0];
				const propsWord = this.properties(hit.match);

				return {
					type: 'hit',
					left,
					right,
					hit: parts[1],
					props: propsWord,
					other: this.shownAnnotations.map(annot => this.words(hit.match, annot.id, false, ''))
				} as HitRow;
			});
		},
		numColumns() {
			return 3 + this.shownAnnotations.length; // left - hit - right - (one per shown annotation)
		},
		annotations: corpusStore.get.annotations,
		firstMainAnnotation: corpusStore.get.firstMainAnnotation,
		shownAnnotations: corpusStore.get.shownAnnotations,
		textDirection: corpusStore.get.textDirection
	},
	methods: {
		sort(payload: string) {
			const store = resultsStore[this.view];
			const currentSort = store.getState().sort;

			// payload will never be inverted
			// so if equal, we know we should always invert
			if (currentSort != null && currentSort === payload) {
				payload = '-' + payload;
			}

			store.actions.sort(payload);
		},

		/**
		 * @param context
		 * @param prop - property to retrieve
		 * @param doPunctBefore - add the leading punctuation?
		 * @param addPunctAfter - trailing punctuation to append
		 * @returns concatenated values of the property, interleaved with punctuation from context['punt']
		 */
		words(context: BLTypes.BLHitSnippetPart, prop: string, doPunctBefore: boolean, addPunctAfter: string): string {
			const parts = [] as string[];
			const n = context[prop] ? context[prop].length : 0;
			for (let i = 0; i < n; i++) {
				if ((i === 0 && doPunctBefore) || i > 0) {
					parts.push(context.punct[i]);
				}
				parts.push(context[prop][i]);
			}
			parts.push(addPunctAfter);
			return parts.join('');
		},

		/**
		 * @param hit - the hit
		 * @param prop - property of the context to retrieve, defaults to PROPS.firstMainProp (usually 'word')
		 * @returns string[3] where [0] == before, [1] == hit and [2] == after, values are strings created by
		 * concatenating and alternating the punctuation and values itself
		 */
		snippetParts(hit: BLTypes.BLHitSnippet, prop?: string): [string, string, string] {
			prop = prop || this.firstMainAnnotation.id;

			const punctAfterLeft = hit.match.word.length > 0 ? hit.match.punct[0] : '';
			const before = this.words(hit.left, prop, false, punctAfterLeft);
			const match = this.words(hit.match, prop, false, '');
			const after = this.words(hit.right, prop, true, '');
			return [before, match, after];
		},

		/** Concat all properties in the context into a large string */
		properties(context: BLTypes.BLHitSnippetPart): string {
			return Object.entries(context)
				.map(([annotation, values]) => [annotation, values.join('')])
				.filter(([annotation, value]) => !!value)
				.map(([annotation, value]) => `${annotation}: ${value}`)
				.join(', ');
		},
	}
});

</script>

<style lang="scss">

</style>

