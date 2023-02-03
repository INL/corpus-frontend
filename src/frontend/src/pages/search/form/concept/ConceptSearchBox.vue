<template>
   <div class='conceptbox' style='text-align: left'>
    <div class="box-header">
     Subquery {{ id}} 
    </div>
    <div>
      <pre style="display:none">
    Current concept: {{  current_concept }}
    Term search URL: <a :href="term_search_url">Hiero</a>
    Terms: {{  JSON.stringify(terms) }}
    Terms2: {{  JSON.stringify(terms_from_lexicon) }}
  </pre>
   </div>
      <table class="t1">
        <tr>  
          <td class="fn">Field:</td><td> <select type="text" v-model="search_field">
             <option v-for="(f,i) in main_fields" :key="i">{{ f }}</option>
          </select></td>
        </tr>
        <tr>
          <td class="fn">Concept:</td><td> <Autocomplete 
            id="ac1"
						placeholder="...concept..."
						
         
						:autocomplete="true"
            :rendering = "{'prepare_data' : d => get_cluster_values(d)}"
						:url="completionURLForConcept"
						v-model="current_concept"/> <button @click="addConcept" title="Add concept to lexicon">⤿ lexicon</button></td>
        </tr>
        <tr>
          <td class="fn">Term:</td><td> <Autocomplete 
            id="ac2"
						placeholder="...term..."

          
						:autocomplete="true"
            :rendering = "{'prepare_data_niet' : d => get_term_values(d), 'promise': term_search_promise}"
						:url="completionURLForTerm"
						v-model="current_term"
            /> <button @click="addTerm" title="Add term to lexicon">⤿ lexicon</button></td>
        </tr>
      
      </table>


      <div class="terms">
        <div v-for="(t,i) in terms" :key="i">
          <span v-if="t.term"><input type="checkbox" v-model="checked_terms[t.term]" @click="() => toggleChecked(t.term)"/>
           {{ t.term }}</span></div>
      </div>

      <button @click.stop="buildQuery">Add selected terms to query</button>
      <button @click.stop="resetQuery">Clear</button>
   </div>
</template>

<script lang="ts">
 

import { toHandlers } from '@vue/runtime-core';
import axios from 'axios'
//import { settings } from './settings.js'
import Autocomplete from '@/components/Autocomplete.vue';
import * as CorpusStore from '@/store/search/corpus';
import Vue from 'vue';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore'; 
type at = ConceptStore.AtomicQuery;
// import AutoComplete from './AutoComplete.vue';
import { uniq, log_error } from './utils'
declare const BLS_URL: string;
const blsUrl: string = BLS_URL;

const requestHeaders = { 'headers': { 'Accept': 'application/json' }, 'auth': { 'username': 'fouke', 'password': 'narawaseraretakunai' } }
type Term = { term: string}

export default Vue.extend ( {
  name: 'ConceptSearchBox',
  components: { Autocomplete},
  props: {
    id: String,
    field: String
  },
  data: () => ({
      debug: false as boolean,
      search_concept: '' as string,
      search_field: '' as string,
      search_term : '' as string,
      current_concept : '' as string,
      current_term : '' as string,
      checked_terms: {} as {[key: string]: boolean},
      fields: ['hallo', 'daar'] as string[],
      terms: [] as Term[],
      corpus: CorpusStore.getState().id as string,
      getters: ConceptStore.get,
      server : 'http://localhost:8080/Oefenen/' as string,
      instance: 'quine_lexicon' as string,
      credentials :  { auth: {
      username: 'fouke',
      password: 'narawaseraretakunai'
        }   }
  }),
 
  methods : {
    alert(s: string)  {
      alert(s)
    },
    buildQuery() {
      const terms = Object.keys(this.checked_terms).filter(t => this.checked_terms[t])
      const scq: ConceptStore.SingleConceptQuery = { terms: terms.map(t => { const z: at = {field: 'lemma', 'value': t}; return z }) }
      try {
        ConceptStore.actions.setSubQuery( {id: this.id, subquery: scq} )
      } catch (e) {
        alert('Whoops:' + e.message)
      }
    },

    toggleChecked(t: string) {
      this.checked_terms[t] = !this.checked_terms[t]
    },
    setSearchTerm(e: string) {
      this.search_term = e
    },
    addTerm() {
      this.terms.push({'term': this.current_term});
      this.insertTerm();
    },
    addConcept() {
      // do something to add to database
      this.insertConcept()
    },
    setSearchConcept(e: string) {
      // alert(`Search concept ${e}`)
      this.search_concept = e
    },
    get_cluster_values(d: { 'data': ConceptStore.LexiconEntry[] }): string[] {
      const vals = uniq(d.data.map(x  => x.cluster))
      return vals
     },
     get_term_values(d: { 'data': ConceptStore.LexiconEntry[] }) {

      const vals = uniq(d.data.map(x => x.term))
      return vals
     },
     insertTerm() {
      const self = this
      const insertIt = {corpus: self.corpus, field: self.search_field, concept:self.current_concept, term: self.current_term, author: 'corpus_frontend'}
      const insertTerm =  encodeURIComponent(JSON.stringify(insertIt))
      const url = `${this.server}/api?instance=${this.instance}&insertTerm=${insertTerm}`
      // ToDo authentication !!!!
      alert(`Yep, post ${JSON.stringify(insertIt)} to ${url}`)
      axios.get(url,{ auth: requestHeaders.auth }).then(r => {
        // alert(`gepiept (${this.exerciseData.type}, ${this.database_id})!`)
        }).catch(e => log_error(e))
      // this.$emit('reload')
    },
    insertConcept() {
      const self = this
      const insertIt = {corpus: self.corpus, field: self.search_field, concept:self.current_concept, author: 'corpus_frontend'}
      const insertConcept =  encodeURIComponent(JSON.stringify(insertIt))
      const url = `${this.server}/api?instance=${this.instance}&insertConcept=${insertConcept}`

      axios.get(url,{ auth: requestHeaders.auth }).then(r => {
        // alert(`gepiept (${this.exerciseData.type}, ${this.database_id})!`)
        }).catch(e => log_error(e))
      // this.$emit('reload')
    },
    resetQuery() {
       this.current_concept = ''
       this.current_term = ''
       this.terms = []
       this.checked_terms = {}
       this.buildQuery()
    }
  },
 
  computed : {
    settings(): ConceptStore.Settings {
      return ConceptStore.get.settings()
     },
     main_fields(): string[] {
      return ConceptStore.get.main_fields()
     },
    subquery_from_store(): ConceptStore.SingleConceptQuery { return ConceptStore.getState().query[this.id] },
    terms_from_lexicon() {
        const query: string = this.term_search_url as string
        axios.get(query, requestHeaders)
            .then(response => {
               console.log(`found in lexicon for field: "${this.search_field}", cluster: "${this.current_concept}"`  + JSON.stringify(response.data.data))
               this.terms = uniq(response.data.data)
               this.terms.map(t => this.checked_terms[t.term] = true)
               return response.data.data
              })
      },
      term_search_url(): string {
        const wQuery = `
              query Quine {
                lexicon (field: "${this.search_field}", cluster: "${this.current_concept}") {
                field,
              cluster,
                term
            }
          }`
        const query: string= `${this.settings.blackparank_server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
        return query
      },

      term_search_promise(): Promise<string[]> {
        const self = this
        const getTermsURL: string = this.term_search_url as string
        const autocompleteURL = `${this.settings.corpus_server}/${this.corpus}/autocomplete/contents/lemma/?term=${this.current_term}`

        console.log(`get Terms: ${getTermsURL}, autocomplete: ${autocompleteURL}`)
        const pdb = axios.get(getTermsURL)
        const termPromiseCorpus: Promise<string[]> = axios.get(autocompleteURL).then(r => r.data)
        const termPromiseDatabase: Promise<string[]>  = pdb.then(r => self.get_term_values(r.data))

        // alert(term_promise_database)

        const promiseBoth: Promise<string[]> = Promise.all([termPromiseDatabase, termPromiseCorpus]).then(r => {
            console.log(JSON.stringify(r))
            const r00 = r[0].filter(x => x)
            return r00.concat(r[1]) // dit gaat mis als en null in db stuk zit....
        })

        return promiseBoth
        // const terms_from_blacklab = axios.get(terms_from_blacklab_term_url)
      },

    completionURLForTerm(): string  {
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
      return `${this.settings.blackparank_server}/api?instance=${this.settings.blackparank_instance}&query=${encodeURIComponent(wQuery)}`
    },

    completionURLForConcept(): string {
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
       return `${this.settings.blackparank_server}/api?instance=${this.settings.blackparank_instance}&query=${encodeURIComponent(wQuery)}`
    },
  },
  created() {
    
    // alert(blsUrl)
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

.conceptbox {
  
  border-style: solid;
  text-align: left;
  margin: 1em;
  padding: 0em;
  zbox-shadow: 10px 5px 5px grey;
  zborder-radius: 10px;
  font-size: 9pt
}

.fn {
  width: 5em;
}
.terms {
  height: 15em;
  overflow-y: auto;
  column-count: 2;
  border-style: solid;
  border-width: 1pt;
  margin-top: 1em;
  margin-left: 1em;
  margin-right: 1em;
  margin-bottom: 1em;

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
