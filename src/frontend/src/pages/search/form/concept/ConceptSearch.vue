<template>
   <div style='text-align: left'>
      <!--
       <div :style="{display: debug?'box':'none'}"><pre>
       
       Query (JSON) {{ queryFieldValue }}
       Query (CQL)  {{ cqlQuery }} {{ queryCQL }}
       Concept {{ concept }}
       To blackparank: <a target="_blank" :href="blackparank_request">{{ blackparank_request }}</a> 
       </pre></div>

      -->
      Search in: <select v-model="element_searched"> 
         <option v-for="(o,i) in getters.settings().searchable_elements" v-bind:key="i">{{ o }}</option>
      </select> 
      <div class='boxes' style='text-align: center'>
        <ConceptSearchBox :ref="'b' +id.toString()" v-for="id in Array.from(Array(nBoxes).keys())" v-bind:key="id" :id="'b' +id.toString()"/>
      </div>
      <button @click="resetQuery">Reset</button>
      <button @click="addBox">Add box</button> 
      <button @click="removeBox">Remove box</button> 
      <button  target="_blank" @click="window.open(getters.settings().lexit_server + '?db=' + getters.settings().lexit_instance + '&table=lexicon', '_blank')">View lexicon</button>
      
      <input type="checkbox" v-model="showQuery">Show query</checkbox>
      <br/>


      <br/>
      <div>
      
       <div style="border-style: solid; border-width: 1pt; margin-top: 1em;" v-if="showQuery">
        <div style="display: none">
          <pre>
            {{  JSON.stringify(settings) }}
          </pre>
        </div>
        <i>Query</i>
        <div style="margin-bottom: 1em" v-for="(e,i) in Object.entries(query_from_store)" v-bind:key="i"><b>{{ e[0] }}</b> → [{{ e[1].terms.filter(t => t.value.length > 0).map(t => t.value).join("; ")}}] </div>
        
        <i>CQL rendition</i> <div class="code">{{  query_cql_from_store }}</div><br/>
        
        <!-- Request in store: <a target="_blank" :href='request_from_store'> .... </a> -->
       </div>
      </div>
    </div>
</template>

<script lang="ts">

import Vue from 'vue';
import VueComponent from 'vue';
import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as InterfaceStore from '@/store/search/form/interface';
import * as PatternStore from '@/store/search/form/patterns';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';
//import { settings } from './settings.js'
declare const BLS_URL: string;
const blsUrl: string = BLS_URL;
import debug from '@/utils/debug';
import axios from 'axios'

import ConceptSearchBox from './ConceptSearchBox.vue' 
import { ConceptQuery } from './conceptStore.js';


export default Vue.extend ({
  components: { ConceptSearchBox }, 
  name: 'ConceptSearch', 
  props: {
    msg: String,
    src : String
  },

  data: () => ({
      debug: false,
      showQuery : false,
      corpus: CorpusStore.getState().id,
      search_in_options: ConceptStore.get.settings().searchable_elements,  //,c2e[CorpusStore.getState().id],
      search_in: 'p',
      nBoxes: 2,
      queries : { // this should be a computed field.....

      },
      queryFieldValue: '',
      filterFieldValue: '', // TODO moet weg....
      cqlQuery: '',
      getters: ConceptStore.get,
      window: window as Window
  }),

  methods : {
    addBox() {
      this.nBoxes++;
    },
    removeBox() {
      this.nBoxes--;
    },
    resetQuery() {
      Object.keys(this.$refs).forEach(k => {
        const ref_k = this.$refs[k]
        //console.log(rk)
        ref_k[0].resetQuery()
      })
      ConceptStore.actions.resetQuery()
    }
  },
  computed : {
     settings(): ConceptStore.Settings {
      return ConceptStore.get.settings()
     },
     query_from_store() { return ConceptStore.getState().query },
     query_cql_from_store() { return ConceptStore.getState().query_cql },
     request_from_store() { return ConceptStore.get.translate_query_to_cql_request() },
     /*
     blackparank_request() {
      // get server from frontend info ....
     const s: ConceptStore.Settings = this.settings
     const query = `${s.blackparank_server}/BlackPaRank?server=${encodeURIComponent(s.corpus_server)}&corpus=${this.corpus}&action=info&query=${encodeURIComponent(this.queryFieldValue)}`
     return query
    },
    */
		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},
    element_searched: {
			get(): string|null { return ConceptStore.getState().target_element; },
			set: ConceptStore.actions.setTargetElement,
		},
  },
  created() {
    UIStore.getState().results.shared.concordanceAsHtml = true;
    debug.debug = false
}
})

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

.code {
    display: block;
    padding: 9.5px;
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.42857143;
    color: #333;

    background-color: #f5f5f5;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: Menlo,Monaco,Consolas,"Courier New",monospace;
}
</style>
