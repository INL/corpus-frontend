<template>
   <div style='text-align: left'>
 
       <div :style="{display: debug?'box':'none'}"><pre>
       
       Query (JSON) {{ queryFieldValue }}
       Query (CQL)  {{ cqlQuery }} {{ queryCQL }}
       Concept {{ concept }}
       To blackparank: <a target="_blank" :href="blackparank_request">{{ blackparank_request }}</a> 
       </pre></div>
      <div class='boxes' style='text-align: center'>
        <ConceptSearchBox v-for="id in Array.from(Array(nBoxes).keys())" v-bind:key="id" :id="'b' +id.toString()" v-on:update_query="updateQuery"/>
      </div>
      <button @click="addBox">Add box</button> <button @click="removeBox">Remove box</button>
      <br/>
      Search in: <select v-model="search_in"> 
         <option v-for="(o,i) in search_in_options" v-bind:key="i">{{ o }}</option>
      </select> 

      <br/>
      <div style="border-style: solid; margin-top: 1em;">
      <input type="checkbox" v-model="showQuery">Show query</checkbox>
       <div v-if="showQuery">Generated query: 
        <div style="font-family:'Courier New', Courier, monospace"> {{ concept? concept:'nopez' }} </div> 
        {{ query_from_store }}
       </div>
      </div>
    </div>
</template>

<script lang="ts">

import Vue from 'vue';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as InterfaceStore from '@/store/search/form/interface';
import * as PatternStore from '@/store/search/form/patterns';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';
import * as GapStore from '@/store/search/form/gap';
import * as HistoryStore from '@/store/search/history';


// @ts-ignore



import { paths } from '@/api';
import * as AppTypes from '@/types/apptypes';
import { getAnnotationSubset } from '@/utils';

/// 


import { settings } from './settings.js'

import axios from 'axios'


import ConceptSearchBox from './ConceptSearchBox.vue' 
import { ConceptQuery } from './conceptStore.js';

const c2e = {'OGL' :['ab'], 'quine' : ['p','s'] }
export default {
  components: { ConceptSearchBox }, 
  name: 'ConceptSearch', 
  props: {
    msg: String,
    src : String
  },

  data() {
    return { 
      debug: false,
      showQuery : false,
      corpus: CorpusStore.getState().id,
      search_in_options: c2e[CorpusStore.getState().id],
      search_in: c2e[CorpusStore.getState().id][0],
      nBoxes: 2,
      queries : { // this should be a computed field.....

      },
      queryFieldValue: "",
      filterFieldValue: "", // TODO moet weg....
      cqlQuery: "",
      
    }
  },

  methods : {
    addBox: function() {
      this.nBoxes++;
    },
    removeBox: function() {
      this.nBoxes--;
    },
    // transformSnippets: null|((snippet?: BLTypes.BLHitSnippet|BLTypes.BLHitSnippet[]) => void);
    setTransformSnippets: function() {
     
      /*
      UIStore.getState().results.shared.transformSnippets = s0 => {
        // alert("Transforming:" + JSON.stringify(s))
        const s = JSON.parse(JSON.stringify(s0))
        const start = s.start
        s.captureGroups.forEach(g => {
          const name = g.name
          const gs = g.start - start
          const ge = g.end - start
          //alert(`${name} at ${gs} for ${s.match.word[gs]} `)
          s.match.word[gs] = '<i>' + name + ":" + s.match.word[gs] + '</i>' // dit moet via een commit ..... // nee dit is niet de manier, moet via template ....
          return s
        })
      }
      */
    },
    updateQueryx: function(q) { // params: {q: any, scq: ConceptStore.SingleConceptQuery}
      
      this.setTransformSnippets()
      const query = {
          "element" : this.search_in, "strict": true, "filter" : this.filterFieldValue
      }
      const queries = {}

      Object.keys(this.queries).forEach(k => {
       const terms = this.queries[k]
       if (terms.length > 0) {
      // alert(JSON.stringify(terms))
         queries[k] = terms // .map(t => { const z = {"field" : "lemma", "value" : t.replace("*",".*")}; return z })
      }})  //else delete q[k]
      //alert(JSON.stringify(query))
      
      
      query["queries"]  = queries
      Object.keys(q).forEach(k => {
       const terms = q[k]
       if (q[k].length > 0) {
      // alert(JSON.stringify(terms))
         queries[k] = terms.map(t => { const z = {"field" : "lemma", "value" : t.replace("*",".*")}; return z })
      }  else delete q[k]
    })
    // alert("Updated query to "  + JSON.stringify(query))
    this.queries = queries;
    this.queryFieldValue = JSON.stringify(query)
    //this.queryForConcordance = query
   }, 

   updateQuery : function(e) {
      //alert("Updating query with:" + JSON.stringify(e))
      this.updateQueryx(e) // en daar gebeurt nu natuurlijk niks mee, dit moet naar de store
      // alert("Updated query:" + JSON.stringify(this.queries))
    }
  },
  
  computed : {
     query_from_store() { return ConceptStore.getState().query },
     blackparank_request() {
      
      const wQuery = `
          query Quine {
            lexicon ( field: "${this.search_field}", cluster: "${this.search_concept}") {
            field,
          cluster,
            term
        }
      }`
      // get server from frontend info ....
     const query = `${settings.backend_server}/BlackPaRank?server=${encodeURIComponent(settings.selectedScenario.corpus_server)}&corpus=${this.corpus}&action=info&query=${encodeURIComponent(this.queryFieldValue)}`
     return query
    },
    
		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},

    queryCQL: {
         get() {
          const self = this

      // const query= `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
    
      // console.log(query)
      // alert(`Info query: ${query}`)

            const geefMee = {"headers": {"Accept":"application/json"}, "auth": {"username":"fouke","password":"narawaseraretakunai"}}

            axios.get(this.blackparank_request, geefMee)
            .then(response => { 
              // alert("INFO: cql=" + JSON.stringify(response.data.pattern))
              self.cqlQuery = response.data.pattern
              //this.$emit(`update_concept_query`, self.cqlQuery)
              this.concept = self.cqlQuery // .set(e)
              return response.data.pattern
              })
          },
        default: ""
    }
  }, 
  created() {
    UIStore.getState().results.shared.concordanceAsHtml = true;
}
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
 
img {
  width: 400px;
}

.boxes {
  display: flex
}
</style>
