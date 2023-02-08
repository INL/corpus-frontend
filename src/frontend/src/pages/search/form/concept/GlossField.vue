<template>
   <div style='text-align: left'>
      <input  :placeholder="fieldName" @click.stop=";" :value="getters.getGlossValue(hitId,fieldName)" @change=setValue($event.target.value) />
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

import * as GlossStore from '@/pages/search/form/concept/glossStore';
//import { settings } from './settings.js'
declare const BLS_URL: string;
const blsUrl: string = BLS_URL;
import debug from '@/utils/debug';
import axios from 'axios'

import ConceptSearchBox from './ConceptSearchBox.vue' 
import { ConceptQuery } from './conceptStore.js';

type myProps =  {
    fieldName: String,
    hitId : String
  }
  
export default Vue.extend ({
  name: 'GlossField',
  props: {
    fieldName: String,
    hitId : String
  },

  data: () => ({
      debug: false,
      corpus: CorpusStore.getState().id,
      setter: null as any,
      getters: GlossStore.get,
  }),

  methods : {
    piep(s: string) {
      alert(s)
    },
    setValue(s: string) {
      GlossStore.actions.setOneGlossField({hitId: this.hitId, fieldName: this.fieldName, fieldValue: s})
    }
  },
  computed : {  },
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
