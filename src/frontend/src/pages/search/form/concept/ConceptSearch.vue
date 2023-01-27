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
      <div class='boxes' style='text-align: center'>
        <ConceptSearchBox v-for="id in Array.from(Array(nBoxes).keys())" v-bind:key="id" :id="'b' +id.toString()"/>
      </div>
      <button @click="addBox">Add box</button> <button @click="removeBox">Remove box</button>
      <br/>
      Search in: <select v-model="search_in"> 
         <option v-for="(o,i) in search_in_options" v-bind:key="i">{{ o }}</option>
      </select> 

      <br/>
      <div style="border-style: solid; margin-top: 1em;">
      <input type="checkbox" v-model="showQuery">Show query</checkbox>
       <div v-if="showQuery">
        <div style="font-family:'Courier New', Courier, monospace"> Generated query:  {{ concept? concept:'nopez' }} </div> 
        query_cql from store {{  query_cql_from_store }}<br/>
        Query as JSON {{  queryFieldValue }}<br/>
        Query in store: {{ query_from_store }} <br/>
        Request in store: <a :href='request_from_store'> {{ true?request_from_store:'effeniet' }} </a>
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
      queryFieldValue: '',
      filterFieldValue: '', // TODO moet weg....
      cqlQuery: '',
    }
  },

  methods : {
    addBox: function() {
      this.nBoxes++;
    },
    removeBox: function() {
      this.nBoxes--;
    },
  },
  computed : {
     query_from_store() { return ConceptStore.getState().query },
     query_cql_from_store() { return ConceptStore.getState().query_cql },
     request_from_store() { return ConceptStore.get.translate_query_to_cql_request() },
     blackparank_request() {
      // get server from frontend info ....
     const query = `${settings.backend_server}/BlackPaRank?server=${encodeURIComponent(settings.selectedScenario.corpus_server)}&corpus=${this.corpus}&action=info&query=${encodeURIComponent(this.queryFieldValue)}`
     return query
    },
		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},
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
