<template>
   <div style='text-align: left'>
      <div class='boxes' style='text-align: center'>
         <ConceptSearchBox id="b1"  field='epistemology' v-on:update_query="updateQuery"/>
         <ConceptSearchBox id="b2"  field='epistemology' v-on:update_query="updateQuery"/>
         <ConceptSearchBox id="b3"  field='epistemology' v-on:update_query="updateQuery"/>
      </div>
    </div>
</template>

<script lang="JavaScript">



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
      markdown: '# markdown-it rulezz!' ,
      queries : {
        'b1' : {},
        'b2' : {},
        'b3' : {}
      }
    }
  },

  methods : {
    updateQuery : function(e) {
      const id = Object.keys(e)[0]
      this.queries[id] = e[id]
      //alert("updateQuery:" + JSON.stringify(this.queries))
      this.$emit(`update_query`, this.queries)
    }
  },
  computed : {
    html() {
      const x = md.render(this.markdown)   
      return md.render(this.markdown)
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
