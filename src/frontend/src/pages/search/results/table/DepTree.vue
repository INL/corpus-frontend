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

import ResultsView from '@/pages/search/results/ResultsView.vue';

import * as InterfaceStore from '@/store/search/form/interface';

import {ReactiveDepTree} from "@/../node_modules/reactive-dep-tree/dist/reactive-dep-tree.umd.js";
import {HitRow} from "@/pages/search/results/table/HitResults.vue"

import * as BLTypes from '@/types/blacklabtypes';
const conllExample = `# text = I am eating a pineapple
    1	I	_	PRON	_	_	2	suj	_	_
    2	am	_	AUX	_	_	0	root	_	_
    3	eating	_	VERB	_	_	2	aux	_	highlight=red
    4	a	_	DET	_	_	5	det	_	_
    5	pineapple	_	NOUN	_	_	3	obj	_	_
`

export default Vue.extend({
	props: {
		hitRowJson: String,
		index: String
	},
	data: () => ({
      showOnlyMatchedRels : true as boolean,
	  renderComponent: true as boolean
	}),
	computed: {
		hitRow() : HitRow { return JSON.parse(this.hitRowJson) },
		conllu() : String { return this.toConllu(JSON.parse(this.hitRowJson), this.index, this.showOnlyMatchedRels)}
		
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
		toConllu(row: HitRow, index: String, onlyMatchedRelations: boolean) : string {

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
					if (('matchInfos' in row) && (row.matchInfos != null))  
					{ 
						Object.keys(row.matchInfos).map(k => {
							const v = row.matchInfos[k]
							if (v.type == 'relation') {
							const rel = v.relType.replace("dep::","")
							const wordnum = v.targetStart - row.start + 1
							const headnum = v.sourceStart - row.start + 1
                            foundRels[wordnum] = rel 
							foundHeads[headnum]  = rel
							}
						})
					} 
					
					
                    const conllu = 
                      (
                       // `# sent_id = s${index}` + "\n" +
                       '# text = ' + word.join(" ") + "\n" + 
                      row.props.head.map((h, i) =>  
                             { 
							   const relIsMatched = i+1 in foundRels
							   const headIsMatched = i+1 in foundHeads
							   const headInHit = wordnum.includes(h)
							   
							   const showRel = headInHit && (relIsMatched || !onlyMatchedRelations)
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

});
</script>

<style lang="scss" scoped>
</style>