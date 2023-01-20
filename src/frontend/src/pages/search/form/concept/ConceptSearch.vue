<template>
   <div style='text-align: left'>
       <div><pre>
       Query (JSON) {{ queryFieldValue }}
       Query (CQL)  {{ cqlQuery }} {{ queryCQL }}
       To blackparank: <a target="_blank" :href="blackparank_request">{{ blackparank_request }}</a> 
       </pre></div>
      <div class='boxes' style='text-align: center'>
         <ConceptSearchBox id="b1"  field='epistemology' v-on:update_query="updateQuery"/>
         <ConceptSearchBox id="b2"  field='epistemology' v-on:update_query="updateQuery"/>
         <ConceptSearchBox id="b3"  field='epistemology' v-on:update_query="updateQuery"/>
      </div>
    </div>
</template>

<script lang="JavaScript">


import { settings } from './settings.js'

import axios from 'axios'

import ConceptSearchBox from './ConceptSearchBox.vue' 
export default {
  components: { ConceptSearchBox }, 
  name: 'ConceptSearch', 
  props: {
    msg: String,
    src : String
  },
  data() {
    return { 
      search_in: "ab",
      queries : {
        'b1' : {},
        'b2' : {},
        'b3' : {}
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

      //alert(JSON.stringify(query))
      
      const queries = {}
      query["queries"]  = queries
      Object.keys(q).forEach(k => {
       const terms = q[k]
       if (q[k].length > 0) {
      // alert(JSON.stringify(terms))
         queries[k] = terms.map(t => { const z = {"field" : "lemma", "value" : t.replace("*",".*")}; return z })
      }  else delete q[k]
    })
    // alert("Updating query -- "  + JSON.stringify(query))
    this.queryFieldValue = JSON.stringify(query)
    //this.queryForConcordance = query
   }, 

   updateQuery : function(e) {
      const id = Object.keys(e)[0]
      this.queries[id] = e[id]
      // alert("updateQuery:" + JSON.stringify(this.queries))
      this.updateQueryx(this.queries) // en daar gebeurt nu natuurlijk niks mee, dit moet naar de store
    }
  },
  computed : {
     blackparank_request() {
      const wQuery = `
          query Quine {
            lexicon (field: "${this.search_field}", cluster: "${this.search_concept}") {
            field,
          cluster,
            term
        }
      }`
    
     const query = `${settings.backend_server}/BlackPaRank?server=${encodeURIComponent(settings.selectedScenario.corpus_server)}&corpus=${settings.selectedScenario.corpus}&action=info&query=${encodeURIComponent(this.queryFieldValue)}`
     return query
    },
    
    queryCQL: {
    
      get() {
         const self = this

    //const query= `${this.server}/api?instance=${this.instance}&query=${encodeURIComponent(wQuery)}`
    
    // console.log(query)
    // alert(`Info query: ${query}`)

        const geefMee={"headers":{"Accept":"application/json"},"auth":{"username":"fouke","password":"narawaseraretakunai"}}

        axios.get(this.blackparank_request, geefMee)
            .then(response => { 
              alert("INFO: cql=" + JSON.stringify(response.data.pattern))
              self.cqlQuery = response.data.pattern
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
