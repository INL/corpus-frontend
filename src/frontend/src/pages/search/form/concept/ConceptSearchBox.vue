<template>
   <div class='conceptbox' style='text-align: left'>
    <div class="box-header">
     Subquery {{ id}} : {<span v-bind:key="i" v-for="(t,i) in terms">{{ t.term }} </span>}
    </div>
    <div>
      <pre style="display:none">
    Main fields: {{ main_fields }} 
    Current concept: {{  current_concept }}
    Term search URL: <a :href="term_search_url">Hiero</a>
    Terms: {{  JSON.stringify(terms) }}
    Terms2: {{  JSON.stringify(terms_from_lexicon) }}
  </pre>
   </div>
      <table class="t1">
        <tr>  
          <td class="fn">Field:</td><td> <select type="text" v-model="search_field">
             <option v-for="(f,i) in fields" :key="i">{{ f }}</option>
          </select></td>
        </tr>
        <tr>
          <td class="fn">Concept:</td><td> <Autocomplete 
            id="ac1"
						placeholder="...concept..."
						

						:autocomplete="true"
            :rendering = "{'prepare_data' : d => get_cluster_values(d)}"
						:url="completionURLForConcept"
						v-model="current_concept"/> <button @click="addConcept">Add to concepts</button></td>
        </tr>
        <tr>
          <td class="fn">Term:</td><td> <Autocomplete 
            id="ac2"
						placeholder="...term..."
						

						:autocomplete="true"
            :rendering = "{'prepare_data_niet' : d => get_term_values(d), 'promise': term_search_promise}"
						:url="completionURLForTerm"
						v-model="current_term"
            /> <button @click="addTerm">Add to terms</button></td>
        </tr>
      
      </table>

      <div class="terms">
        <div v-for="(t,i) in terms" :key="i">
          <input type="checkbox" v-model="checked_terms[t.term]" @click="() => toggleChecked(t.term)"/>
           {{ t.term }}</div>
      </div>

      <button @click="buildQuery">Add selected terms to query</button>
      <div :style="{display: debug?'box':'none'}">
     Wappie: {{  wappie  }} <br/>
     Wapwap: {{  wapwap }}
    </div>
   </div>
</template>

<script lang="JavaScript">
 

import { toHandlers } from '@vue/runtime-core';
import axios from 'axios'
import { settings } from './settings.js'
import Autocomplete from '@/components/Autocomplete.vue';
import * as CorpusStore from '@/store/search/corpus';
//import AutoComplete from './AutoComplete.vue';
import { uniq } from './utils'

export default {
  name: 'ConceptSearchBox', 
  components: { Autocomplete},
  props: {
    id: String,
    field: String
  },
  data() {
    return { 
      debug: false,
      search_concept: "",
      search_field: this.field,
      search_term : "",
      current_concept : "",
      current_term : "",
      checked_terms: {},
      wapwap: "",
      fields: ["hallo", "daar"],
      terms: [],
      corpus: CorpusStore.getState().id,
      server : 'http://localhost:8080/Oefenen/',
      instance: 'quine_lexicon',
      credentials :  { auth: {
      username: 'fouke',
      password: 'narawaseraretakunai'
        }   }
    }
  },
 
  methods : {
    alert: function(s)  {
      alert(s)
    },
    buildQuery: function() {
      //alert(JSON.stringify(this.id))

      const terms = Object.keys(this.checked_terms).filter(t => this.checked_terms[t])
      const id = this.id
      const query = {
        [id] : terms
      }
      // alert("query box: " + JSON.stringify(query))
      this.$emit(`update_query`, query) // in state frotten. Submodule voor maken?
    },
    toggleChecked: function(t) {
      this.checked_terms[t] = !this.checked_terms[t]
    },
    setSearchTerm: function(e) {
      this.search_term = e
    },
    addTerm: function() {
      this.terms.push({'term': this.current_term})
      //alert("Pushing:"  + this.current_term  + " to " + JSON.stringify(this.terms))
    },
    addConcept: function() {
      // do something to add to database
    },
    setSearchConcept: function(e) {
      // alert(`Search concept ${e}`)
      this.search_concept = e
    },
    get_cluster_values(d) {
      //alert(JSON.stringify(d))
      const vals = uniq(d['data'].map(x => x['cluster']))
      //alert(JSON.stringify(vals))
      return vals
     },
     get_term_values(d) {
      //alert(JSON.stringify(d))
      const vals = uniq(d['data'].map(x => x['term']))
      //alert(JSON.stringify(vals))
      return vals
     }
  },
 
  computed : {

    terms_from_lexicon() {
        // console.log(query)
        const geefMee={"headers":{"Accept":"application/json"},"auth":{"username":"fouke","password":"narawaseraretakunai"}}
        const query = this.term_search_url
        axios.get(query, geefMee)
            .then(response => { 
               console.log(`found in lexicon for field: "${this.search_field}", cluster: "${this.current_concept}"`  + JSON.stringify(response.data.data))
               this.terms = uniq(response.data.data)
               this.terms.forEach(t => this.checked_terms[t.term] = false)
               return response.data.data
              })
      },

      term_search_url() {
        const wQuery = `
              query Quine {
                lexicon (field: "${this.search_field}", cluster: "${this.current_concept}") {
                field,
              cluster,
                term
            }
          }`
        const query= `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
        return query
      },

      term_search_promise() {
        const self = this
        const terms_from_database_url = this.term_search_url
        const pdb = axios.get(terms_from_database_url)
        const term_promise_corpus = axios.get(`http://localhost:8080/blacklab-server/${this.corpus}/autocomplete/contents/lemma/?term=${this.current_term}`).then(r => r.data)
        // http://localhost:8080/blacklab-server/OGL/autocomplete/contents/word_or_lemma/?term=a
        //alert(terms_from_database_url + " -->" + pdb +  "...." + JSON.stringify(pdb))
        const term_promise_database = pdb.then(r => self.get_term_values(r.data))
        //alert(term_promise_database)
        
        const promise_both = Promise.all([term_promise_database, term_promise_corpus]).then(r => {
            console.log(JSON.stringify(r))
            return r[0].concat(r[1])
        })
        
        return promise_both
        // const terms_from_blacklab = axios.get(terms_from_blacklab_term_url)
      },

      wappie() {
        const self = this
        return this.term_search_promise.then(d => self.wapwap = JSON.stringify(d))
      },

    main_fields: {
      get() {
        const wQuery = `
              query Quine {
                lexicon(corpus : "${this.corpus}") {
                field
            }
          }`
        
        const query= `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
        //alert("Main field query:" + JSON.stringify(wQuery))
        /// console.log(query)
        // alert("Something happens?")
        const geefMee={"headers":{"Accept":"application/json"},"auth":{"username":"fouke","password":"narawaseraretakunai"}}
        
        axios.get(query, geefMee)
            .then(response => { 
                // alert("Fields query response: " + JSON.stringify(response.data.data))
               const fields = uniq(response.data.data.map(x => x.field))
               this.fields = fields
               return fields
              })

      },
        default: ["aap", "noot", "mies"]
    },


    completionURLForTerm()  {
      const field = this.search_field
      const concept = this.current_concept
      const term = this.current_term
      const wQuery = `
              query Quine {
                lexicon (term: "/^${term}/", field: "${field}", cluster: "${concept}") {
                field,
              cluster,
                term
            }
          }`
      //console.log("AUTOCOMPLETE query: " + JSON.stringify(wQuery).replace(/\\n/, '\n'))
      return `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
    },
  
    completionURLForConcept () {
       const field = this.search_field
       const value = this.current_concept
       const wQuery = `
              query Quine {
                lexicon (cluster: "/^${value}/", field: "${field}") {
                field,
                cluster,
                term
            }
          }`
       //console.log("AUTOCOMPLETE query: " + JSON.stringify(wQuery).replace(/\\n/, '\n'))
       return `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
    },
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

.conceptbox {
  zbackground-color: rgb(230,230,255);
  border-style: solid;
  text-align: left;
  margin: 1em;
  padding: 0em;
  zbox-shadow: 10px 5px 5px grey;
  zborder-radius: 10px;
  font-size: 9pt
}

.fn {
  width: 9em;
}
.terms {
  height: 15em;
  overflow-y: scroll 
}
.t1 {
  table-layout: auto;
}
.box-header
{
  color: white;
  background-color: #ae0932 !important;
}
</style>
