<template>
	<div style="border-style: solid; padding: 1em; border-width: 1pt; border-color: lightblue;">
		<reactive-dep-tree v-if="renderComponent"
			ref="tree"
			interactive="true"
			minimal="true"
			:conll="conllu" >
		</reactive-dep-tree>

		Show only matched relations: <input type="checkbox" id="checkbox" @change="forceRender" v-model="showOnlyMatchedRels"/>
	</div>
</template>

<script lang="ts">
// https://github.com/kirianguiller/reactive-dep-tree/
import Vue from 'vue';

// @ts-ignore
import {ReactiveDepTree} from "@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js";
import {HitRow} from "@/pages/search/results/table/HitResults.vue"

const conllExample = `# text = I am eating a pineapple
    1	I	_	PRON	_	_	2	suj	_	_
    2	am	_	AUX	_	_	0	root	_	_
    3	eating	_	VERB	_	_	2	aux	_	highlight=red
    4	a	_	DET	_	_	5	det	_	_
    5	pineapple	_	NOUN	_	_	3	obj	_	_
`

export default Vue.extend({
	props: {
		hit: Object as () => HitRow,
		index: String
	},
	data: () => ({
		showOnlyMatchedRels : true,
		renderComponent: true
	}),
	computed: {
		conllu(): string {
			debugger;
			const hit = this.hit;

			const word = hit.props.word
			const rel = hit.props.deprel
			const wordnum = hit.props.wordnum
			const lemma = hit.props.lemma
			const pos = hit.props.pos
			const xpos = hit.props.xpos
			const start: number = +wordnum[0]
			//console.log(JSON.stringify(row.matchInfos))
			//console.log(row.start)
			interface x  { [key: number]: string }
			const foundRels : x =  {}
			const foundHeads : x = {}
			if (('matchInfos' in hit) && (hit.matchInfos != null)) {
				Object.values(hit.matchInfos).map(v => {
					if (v.type == 'relation') {
						const rel = v.relType.replace("dep::","")
						const wordnum = v.targetStart - hit.start + 1
						const headnum = v.sourceStart - hit.start + 1
						foundRels[wordnum] = rel
						foundHeads[headnum]  = rel
					}
				})
			}

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

			const conllu =
				(
				// `# sent_id = s${index}` + "\n" +
				'# text = ' + word.join(" ") + "\n" +
				hit.props.head.map((h, i) =>
						{
						const relIsMatched = i+1 in foundRels
						const headIsMatched = i+1 in foundHeads
						const headInHit = wordnum.includes(h)

						const showRel = headInHit && (relIsMatched || !this.showOnlyMatchedRels)
						//console.log(`i: ${i}, headInHit: ${headInHit}, relIsMatched: ${relIsMatched}, onlyMatchedRelations: ${onlyMatchedRelations}, showRel: ${showRel}`)
						const h1 = showRel?  +h -start + 1: '_';
						const rel1 = showRel? rel[i] : '_';
						const misc = (relIsMatched||headIsMatched)?  'highlight=red' : '_';
						return '    ' + Array(+wordnum[i] - start + 1, word[i], lemma[i], pos[i], xpos[i], '_', h1, rel1, '_', misc).join("\t")
					}).join("\n"))
			//console.log('matched targets:' + JSON.stringify(foundRels))
			//console.log('matched sources:' + JSON.stringify(foundHeads))
			//console.log(conllu)
			return conllu;
		}

	},
	methods: {
		async forceRender() {
			// Remove MyComponent from the DOM
			this.renderComponent = false;

			// Then, wait for the change to get flushed to the DOM
			await this.$nextTick();

			// Add MyComponent back in
			this.renderComponent = true;
		},
	},
});
</script>

<style lang="scss" scoped>
</style>