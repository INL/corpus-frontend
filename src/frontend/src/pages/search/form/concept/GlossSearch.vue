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
      <h3>Search user glosses</h3>

      
      <div class='glossfields' style='text-align: center'>
        <GlossQueryField  v-for="(o,i) in gloss_fields" v-bind:key="i" :fieldDescription="o"/>
      </div>

      <button @click="resetQuery">Reset</button>
  
      <input type="checkbox" v-model="showQuery">Show query</checkbox>
      <br/>


      <br/>
      <div>
      
      
       <div style="border-style: solid; border-width: 1pt; margin-top: 1em; padding: 4pt" v-if="showQuery">
        <div style="display: box">
          <pre>
            JSON: {{  JSON.stringify(query_from_store) }}
            CQL {{  query_cql_from_store }}
          </pre>
        </div>
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

import GlossQueryField from './GlossQueryField.vue'
import { ConceptQuery } from './conceptStore.js';
import * as GlossStore from '@/pages/search/form/concept/glossStore';

export default Vue.extend ({
  components: { GlossQueryField }, 
  name: 'GlossSearch', 
  props: {
    msg: String,
    src : String
  },

  data: () => ({
      debug: false,
      showQuery : false,
      corpus: CorpusStore.getState().id,

      queries : { // this should be a computed field.....

      },
      window: window as Window
  }),

  methods : {

    resetQuery() {
      Object.keys(this.$refs).forEach(k => {
        const ref_k = this.$refs[k]
        //console.log(rk)
        //ref_k[0].resetQuery()
      })
      ConceptStore.actions.resetQuery()
    }
  },
  computed : {
     settings(): GlossStore.Settings {
      return GlossStore.get.settings()
     },
     gloss_fields() { return GlossStore.get.settings().gloss_fields },
     query_from_store() { return GlossStore.getState().gloss_query },
     query_cql_from_store() { return GlossStore.getState().gloss_query_cql },
     
     /*
     blackparank_request() {
      // get server from frontend info ....
     const s: ConceptStore.Settings = this.settings
     const query = `${s.blackparank_server}/BlackPaRank?server=${encodeURIComponent(s.corpus_server)}&corpus=${this.corpus}&action=info&query=${encodeURIComponent(this.queryFieldValue)}`
     return query
    },
    */

    /*
		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},
    element_searched: {
			get(): string|null { return ConceptStore.getState().target_element; },
			set: ConceptStore.actions.setTargetElement,
		},
    */
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
