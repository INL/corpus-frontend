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
    </div>
</template>

<script lang="JavaScript">

import Vue from 'vue';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as InterfaceStore from '@/store/search/form/interface';
import * as PatternStore from '@/store/search/form/patterns';
import * as GapStore from '@/store/search/form/gap';
import * as HistoryStore from '@/store/search/history';

import Annotation from '@/pages/search/form/Annotation.vue';

import Lexicon from '@/pages/search/form/Lexicon.vue';
import SelectPicker, { Option } from '@/components/SelectPicker.vue';
// @ts-ignore
import Autocomplete from '@/components/Autocomplete.vue';
import uid from '@/mixins/uid';

import { QueryBuilder } from '@/modules/cql_querybuilder';

import { paths } from '@/api';
import * as AppTypes from '@/types/apptypes';
import { getAnnotationSubset } from '@/utils';

/// 

import { settings } from './settings.js'

import axios from 'axios'


import ConceptSearchBox from './ConceptSearchBox.vue' 

const c2e = {"OGL" :"ab", "quine" : "p" }
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
      corpus: CorpusStore.getState().id,
      search_in: c2e[CorpusStore.getState().id],
      nBoxes: 2,
      queries : { // this should be a computed field.....

      },
      queryFieldValue: "",
      filterFieldValue: "", // TODO moet weg....
      cqlQuery: "",
      
    }
  },

  methods : {
    updateQueryx: function(q) {
      const query = {
          "element" : this.search_in, "strict": true, "filter" : this.filterFieldValue
      }
      const queries = {}

      Object.keys(this.queries).forEach(k => {
       const terms = this.queries[k]
       if (terms.length > 0) {
      // alert(JSON.stringify(terms))
         queries[k] = terms.map(t => { const z = {"field" : "lemma", "value" : t.replace("*",".*")}; return z })
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
    this.queryFieldValue = JSON.stringify(query)
    //this.queryForConcordance = query
   }, 

   updateQuery : function(e) {
      alert("Updating query with:" + JSON.stringify(e))
      this.updateQueryx(e) // en daar gebeurt nu natuurlijk niks mee, dit moet naar de store
      alert("Updated query:" + JSON.stringify(this.queries))
    }
  },
  
  computed : {
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
			get() { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
      default: "[word='paard']"
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
              this.$emit(`update_concept_query`, self.cqlQuery)
              //this.concept.set(e)
              return response.data.pattern
              })
          },
        default: ""
    }
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
