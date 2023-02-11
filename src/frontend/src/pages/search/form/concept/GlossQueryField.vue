<template>
   <div  class='glossQueryField' @click.stop=";" style='text-align: left'>
    <span  v-if="fieldDescription.type.values.length>0">
      {{ fieldDescription.fieldName }}:
      <select :value="currentValue" @change=setValue($event.target.value)>
        
         <option v-for="(v,i) in fieldDescription.type.values" v-bind:key="i">{{ v }}</option>
      </select>
    </span>
    <span v-else>
    {{ fieldDescription.fieldName }}: <input   :placeholder="fieldDescription.fieldName" @click.stop=";" :value="currentValue" @change=setValue($event.target.value) />
    </span>
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

  
export default Vue.extend ({
  name: 'GlossQueryField',
  props: {
    fieldDescription: GlossStore.GlossFieldDescription
  },

  data: () => ({
      debug: false,
      corpus: CorpusStore.getState().id,
      getters: GlossStore.get,
  }),

  methods : {
    piep(s: string) {
      alert(s)
    },
    setValue(s: string) {
      // alert(`Set value: ${this.fieldName}=${s} at ${this.hit_first_word_id}`)
      GlossStore.actions.setOneGlossQueryField({fieldName: this.fieldDescription.fieldName, fieldValue : s })
    }
  },
  computed : {
    currentValue()  {
      const v =  GlossStore.get.getGlossQueryFieldValue(this.fieldDescription.fieldName)
      return v
    }
  },
  created() {
    UIStore.getState().results.shared.concordanceAsHtml = true;
    debug.debug = false
  }, 
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

.glossQueryField {
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
