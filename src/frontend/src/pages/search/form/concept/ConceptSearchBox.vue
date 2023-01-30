<template>
   <div class='conceptbox' style='text-align: left'>
    <div class="box-header">
     Subquery {{ id}} : {<span v-bind:key="i" v-for="(t,i) in terms">{{ t.term }} </span>}
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
   </div>
</template>

<script lang="ts">
 

import { toHandlers } from '@vue/runtime-core';
import axios from 'axios'
import { settings } from './settings.js'
import Autocomplete from '@/components/Autocomplete.vue';
import * as CorpusStore from '@/store/search/corpus';
import Vue from 'vue';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore'; 
type at = ConceptStore.AtomicQuery;
// import AutoComplete from './AutoComplete.vue';
import { uniq, log_error } from './utils'
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
      checked_terms: {} as {[key: string] : boolean},
      fields: ['hallo', 'daar'] as string[],
      terms: [] as Term[],
      corpus: CorpusStore.getState().id as string,
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
      // alert(JSON.stringify(this.id))

      const terms = Object.keys(this.checked_terms).filter(t => this.checked_terms[t])
      const scq: ConceptStore.SingleConceptQuery = { terms: terms.map(t => { const z: at = {field: 'lemma', 'value': t}; return z }) }
      // console.log(scq)
      try {
        // alert(JSON.stringify(ConceptStore.actions))
        ConceptStore.actions.setSubQuery( {id: this.id, subquery: scq} )
      } catch (e) {
        alert('Whoops:' + e.message)
      }
    },

    toggleChecked(t: string) {
      this.checked_terms[t] = !this.checked_terms[t]
    },
    setSearchTerm(e:string) {
      this.search_term = e
    },
    addTerm() {
      this.terms.push({'term': this.current_term});
      this.insertTerm();
      //alert("Pushing:"  + this.current_term  + " to " + JSON.stringify(this.terms))
    },
    addConcept() {
      // do something to add to database
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
      axios.get(url,{ auth: settings.credentials.auth }).then(r => {
        // alert(`gepiept (${this.exerciseData.type}, ${this.database_id})!`)
        }).catch(e => log_error(e))
      // this.$emit('reload')
    },
    insertConcept() {
      const self = this
      const insertIt = {corpus: self.corpus, field: self.search_field, concept:self.current_concept, author: 'corpus_frontend'}
      const insertConcept =  encodeURIComponent(JSON.stringify(insertIt))
      const url = `${this.server}/api?instance=${this.instance}&insertConcept=${insertConcept}`

      axios.get(url,{ auth: settings.credentials.auth }).then(r => {
        // alert(`gepiept (${this.exerciseData.type}, ${this.database_id})!`)
        }).catch(e => log_error(e))
      // this.$emit('reload')
    },
    getMainFields() {
      const wQuery = `
              query Quine {
                lexicon(corpus : "${this.corpus}") {
                field
            }
          }`
      const query = `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
      axios.get(query, requestHeaders)
        .then(response => {
          // alert("Fields query response: " + JSON.stringify(response.data.data))
          const fields = uniq(response.data.data.map(x => x.field))
          this.fields = fields
          return fields
        })
    }
  },
 
  computed : {
    subquery_from_store(): ConceptStore.SingleConceptQuery { return ConceptStore.getState().query[this.id] },
    terms_from_lexicon() {
        const query: string = this.term_search_url as string
        axios.get(query, requestHeaders)
            .then(response => { 
               console.log(`found in lexicon for field: "${this.search_field}", cluster: "${this.current_concept}"`  + JSON.stringify(response.data.data))
               this.terms = uniq(response.data.data)
               this.terms.map(t => this.checked_terms[t.term] = false)
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
        const query: string= `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
        return query
      },

      term_search_promise(): Promise<string[]> {
        const self = this
        const getTermsURL : string = this.term_search_url as string
        const pdb = axios.get(getTermsURL)
        const termPromiseCorpus: Promise<string[]> = axios.get(`http://localhost:8080/blacklab-server/${this.corpus}/autocomplete/contents/lemma/?term=${this.current_term}`).then(r => r.data)
        const termPromiseDatabase: Promise<string[]>  = pdb.then(r => self.get_term_values(r.data))
        // alert(term_promise_database)

        const promiseBoth: Promise<string[]> = Promise.all([termPromiseDatabase, termPromiseCorpus]).then(r => {
            console.log(JSON.stringify(r))
            return r[0].concat(r[1])
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
      return `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
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
       return `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
    },
  },
  created() {
    this.getMainFields()
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
