<template>
	<div v-if="hasRelations" style="border-style: solid; padding: 1em; border-width: 1pt; border-color: lightblue;" >
		<reactive-dep-tree
			minimal
			interactive
			conll="
# text = I am eating a pineapple
1	I	_	PRON	_	_	2	suj	_	_
2	am	be	AUX	_	_	0	root	_	_
3	eating	_	VERBtastic	_	_	2	aux	_	highlight=red
4	a	_	DET	_	_	5	det	_	_
5	pineapple	_	NOUN	_	_	3	obj	_	_
"></reactive-dep-tree>

		Show only matched relations: <input type="checkbox" id="checkbox" @change="$forceUpdate()" v-model="showOnlyMatchedRels"/>
	</div>
</template>

<script lang="ts">
// https://github.com/kirianguiller/reactive-dep-tree/
import Vue from 'vue';

// @ts-ignore
import {ReactiveDepTree} from '@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js';
import {HitRowData} from '@/pages/search/results/table/HitRow.vue';

const conllExample = `# text = I am eating a pineapple
    1	I	_	PRON	_	_	2	suj	_	_
    2	am	_	AUX	_	_	0	root	_	_
    3	eating	_	VERB	_	_	2	aux	_	highlight=red
    4	a	_	DET	_	_	5	det	_	_
    5	pineapple	_	NOUN	_	_	3	obj	_	_
`

export default Vue.extend({
	components: {
		ReactiveDepTree
	},
	props: {
		data: Object as () => HitRowData,
	},
	data: () => ({
		showOnlyMatchedRels : true,
	}),
	computed: {
		hasRelations(): boolean {
			return !!this.data.hit.matchInfos?.captured_rels?.infos?.length;
		},
		conllu(): string {
			const hit = this.data.hit;
			if (!('start' in hit || !hit.matchInfos)) return '';

			// TODO make the relation dynamic.

			// connlu is a bottom-up format?
			// i.e. everything points to the parent, not to the children.

			// ID   FORM     LEMMA   UPOS    XPOS     FEATS  HEAD    DEPREL   DEPS   MISC
			return `
			# text = I am eating a pineapple
			1    I         _      PRON    _        _      2       suj      _      _
			2    am        _      AUX     _        _      0       root     _      _
			3    eating    _      VERB    _        _      2       aux      _      highlight=red
			4    a         _      DET     _        _      5       det      _      _
			5    pineapple _      NOUN    _        _      3       obj      _      _
			`

			// const word = hit.match.word
			// const rel = hit.match.deprel
			// const wordnum = hit.match.wordnum
			// const lemma = hit.match.lemma
			// const pos = hit.match.pos
			// const xpos = hit.match.xpos
			// const start: number = +wordnum[0]
			// //console.log(JSON.stringify(row.matchInfos))
			// //console.log(row.start)
			// interface x  { [key: number]: string }
			// const foundRels : x =  {}
			// const foundHeads : x = {}
			// if (('matchInfos' in hit) && (hit.matchInfos != null)) {
			// 	Object.values(hit.matchInfos).map(v => {
			// 		if (v.type == 'relation') {
			// 			const rel = v.relType.replace("dep::","")
			// 			const wordnum = v.targetStart - hit.start + 1
			// 			const headnum = v.sourceStart - hit.start + 1
			// 			foundRels[wordnum] = rel
			// 			foundHeads[headnum]  = rel
			// 		}
			// 	})
			// }

			// ID   FORM     LEMMA   UPOS    XPOS     FEATS  HEAD    DEPREL   DEPS   MISC
			// # text = I am eating a pineapple

			// 1    I         _      PRON    _        _      2       suj      _      _
			// 2    am        _      AUX     _        _      0       root     _      _
			// 3    eating    _      VERB    _        _      2       aux      _      highlight=red
			// 4    a         _      DET     _        _      5       det      _      _
			// 5    pineapple _      NOUN    _        _      3       obj      _      _

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

			// `# sent_id = s${index}` + "\n" +
			// const conllu = `# text = '${word.join(' ')}\n${
			// 	hit.match.head.map((h, i) => {
			// 		const relIsMatched = i+1 in foundRels
			// 		const headIsMatched = i+1 in foundHeads
			// 		const headInHit = wordnum.includes(h)

			// 		const showRel = headInHit && (relIsMatched || !this.showOnlyMatchedRels)
			// 		//console.log(`i: ${i}, headInHit: ${headInHit}, relIsMatched: ${relIsMatched}, onlyMatchedRelations: ${onlyMatchedRelations}, showRel: ${showRel}`)
			// 		const h1 = showRel?  +h -start + 1: '_';
			// 		const rel1 = showRel? rel[i] : '_';
			// 		const misc = (relIsMatched||headIsMatched)?  'highlight=red' : '_';
			// 		return '    ' + Array(+wordnum[i] - start + 1, word[i], lemma[i], pos[i], xpos[i], '_', h1, rel1, '_', misc).join("\t")
			// 	}).join("\n")
			// }`;
			//console.log('matched targets:' + JSON.stringify(foundRels))
			//console.log('matched sources:' + JSON.stringify(foundHeads))
			//console.log(conllu)
			// return conllu;
		}

	},
	mounted() {
		this.$forceUpdate();
	}
});
</script>

<style lang="scss" scoped>
</style>