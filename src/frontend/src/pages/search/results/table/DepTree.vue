<template>
	<div>
		<!-- Debug whatever we computed -->
		<!-- <pre>{{ {sentenceLength: sensibleArray.length, relationInfo, relations: hit?.matchInfos?.captured_rels?.infos} }}</pre> -->

		<!-- Table to debug the connlu string. -->
		<!-- <div v-if="connlu" style="max-width: 1000px; overflow: auto;">
			<table style="width: 100%; table-layout: fixed;">
				<tr v-for="row in connlu.split('\n')">
					<td style="white-space: nowrap; border: 1px solid #ccc; text-overflow: ellipsis; overflow: hidden;" :title="cell" v-for="cell in row.split('\t')">{{ cell }}</td>
				</tr>
			</table>
		</div> -->

		<reactive-dep-tree v-if="connlu && renderTree" ref="tree"
			minimal
			interactive
			:conll="connlu"
		></reactive-dep-tree>
	</div>
</template>

<script lang="ts">
// https://github.com/kirianguiller/reactive-dep-tree/
import Vue from 'vue';

// @ts-ignore
import {ReactiveDepTree} from '@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js';
import {HitRowData} from '@/pages/search/results/table/HitRow.vue';
import { BLHit, BLHitSnippet, BLHitSnippetPart, BLRelationMatchRelation } from '@/types/blacklabtypes';

/* https://universaldependencies.org/format.html
Sentences consist of one or more word lines, and word lines contain the following fields:

ID:     Word index, integer starting at 1 for each new sentence; may be a range for multiword tokens; may be a decimal number for empty nodes (decimal numbers can be lower than 1 but must be greater than 0).
FORM:   Word form or punctuation symbol.
LEMMA:  Lemma or stem of word form.
UPOS:   Universal part-of-speech tag.
XPOS:   Optional language-specific (or treebank-specific) part-of-speech / morphological tag; underscore if not available.
FEATS:  List of morphological features from the universal feature inventory or from a defined language-specific extension; underscore if not available.
HEAD:   Head of the current word, which is either a value of ID or zero (0).
DEPREL: Universal dependency relation to the HEAD (root iff HEAD = 0) or a defined language-specific subtype of one.
DEPS:   Enhanced dependency graph in the form of a list of head-deprel pairs.
MISC:   Any other annotation.
*/
// const conllExample =
// `# text = I am eating a pineapple
// 1	I	_	PRON	_	_	2	suj	_	_
// 2	am	_	AUX	_	_	0	root	_	_
// 3	eating	_	VERB	_	_	2	aux	_	highlight=red
// 4	a	_	DET	_	_	5	det	_	_
// 5	pineapple	_	NOUN	_	_	3	obj	_	_`


function flatten(h?: BLHitSnippetPart, values?: string[]): Array<Record<string, string>> {
	const r = [] as Array<Record<string, string>>;
	if (!h) return r;
	if (values) {
		values.forEach(k => {
			if (k in h) {
				h[k].forEach((v, i) => {
					r[i] = r[i] || {};
					r[i][k] = v;
				})
			}
		});
	} else {
		Object.entries(h).forEach(([k, v]) => {
			v.forEach((vv, i) => {
				r[i] = r[i] || {};
				r[i][k] = vv;
			})
		})
	}
	return r;
}

export default Vue.extend({
	components: {
		ReactiveDepTree
	},
	props: {
		data: Object as () => HitRowData,
		snippet: Object as () => BLHitSnippet|undefined,

		// TODO
		dir: String as () => 'ltr'|'rtl',
		mainAnnotation: String,
		otherAnnotations: Object as () => Record<'lemma'|'upos'|'xpos'|'feats', string>,
	},
	data: () => ({
		renderTree: true,
	}),
	computed: {
		relationInfo(): undefined|Array<undefined|{parentIndex: number; label: string;}> {
			const hit = this.data.hit;
			if (!this.hit?.matchInfos) return undefined;

			const r: Array<{parentIndex: number;label: string;}> = [];
			const doRelation = (v: BLRelationMatchRelation) => {
				// Connlu can only have one parent, so skip if the relation is not one-to-one

				if (!(v.targetEnd - v.targetStart > 1) && (v.sourceStart == null || !(v.sourceEnd! - v.sourceStart > 1))) {
					// translate the indices to something that makes sense
					const sourceIndex = v.sourceStart != null ? v.sourceStart - this.indexOffset : -1; // 0 signifies root.
					const targetIndex = v.targetStart - this.indexOffset;
					// add the relation to the sensible array

					r[targetIndex] = {
						// might be undefined for root?
						parentIndex: sourceIndex,
						//@ts-ignore
						label: v.relType,
						// @ts-ignore
						sourceObject: v
					}
				}
			}

			Object.entries(hit.matchInfos || {}).forEach(mi => {
				const [k, v] = mi;
				// Not interested in non-relation matches.
				if (v.type === 'relation') doRelation(v);
				else if (v.type === 'list') v.infos.forEach(doRelation);
			})
			return r.length ? r : undefined;
		},
		connlu(): string {
			if (!this.relationInfo) return '';

			let header = '# text = ';
			let rows: string[][] = [];

			for (let i = 0; i < this.sensibleArray.length; ++i) {
				const rel = this.relationInfo[i];
				const token = this.sensibleArray[i];
				// Sometimes relations contains relations point outside the matched hit.
				// We could compute the sensibleArray based on the hit snippet
				// (which is larger and probably does contain the tokens), but then the tree component would end up rendering something like 50 tokens, which is way too wide.
				if (!token) continue;

				// ID   FORM     LEMMA   UPOS    XPOS     FEATS  HEAD    DEPREL   DEPS   MISC
				// # text = I am eating a pineapple
				// 1    I         _      PRON    _        _      2       suj      _      _
				// 2    am        _      AUX     _        _      0       root     _      _
				// 3    eating    _      VERB    _        _      2       aux      _      highlight=red
				// 4    a         _      DET     _        _      5       det      _      _
				// 5    pineapple _      NOUN    _        _      3       obj      _      _

				// omit punctuation before first word of sentence.
				if (i !== 0) header = header + token.punct;
				header += token[this.mainAnnotation];

				const row = [] as string[];
				row.push((1+i).toString()); // index
				row.push(token[this.mainAnnotation]); // form
				if (this.otherAnnotations.lemma) row.push(token[this.otherAnnotations.lemma]); else row.push('_'); // lemma
				if (this.otherAnnotations.upos)  row.push(token[this.otherAnnotations.upos]);  else row.push('_'); // upos
				if (this.otherAnnotations.xpos)  row.push(token[this.otherAnnotations.xpos]);  else row.push('_'); // xpos
				if (this.otherAnnotations.feats) row.push(token[this.otherAnnotations.feats]); else row.push('_'); // feats
				row.push(rel && rel.parentIndex < this.sensibleArray.length  ? (rel.parentIndex + 1).toString() : '_'); // head
				row.push(rel ? rel.label : '_'); // deprel
				row.push('_'); // deps
				row.push(i + this.indexOffset >= this.hit!.start && i + this.indexOffset < this.hit!.end ? `highlight=red` : '_'); // misc

				rows.push(row);
			}

			if (!rows.length) return '';

			return header + '\n' + rows.map(row => row.join('\t')).join('\n');
		},

		hit(): BLHit|undefined { return 'start' in this.data.hit ? this.data.hit : undefined; },
		indexOffset(): number { return this.hit ? this.hit.start - (this.hit.left?.punct || []).length : 0; },
		// Make the hit array make sense, since indexing into three non-0 indexed objects is a bit of a pain.
		// Basically just make an array of key-value maps that contain the annotations for each token. e.g. [{word: 'I', lemma: 'i'}, {word: 'am', lemma: 'be'}, ...]
		sensibleArray(): Array<Record<string, string>> {
			if (!this.hit || !this.hit.matchInfos) return [];
			const extract = ['punct', this.mainAnnotation].concat(Object.values(this.otherAnnotations));

			const {left, match, right} =  this.hit;

			return flatten(left, extract).concat(flatten(match, extract)).concat(flatten(right, extract));
		},
	},
	watch: {
		connlu() {
			// Tree component is somehow not reactive..
			this.renderTree = false;
			this.$nextTick(() => this.renderTree = true);
		}
	}
});
</script>

<style lang="scss" scoped>
</style>