<template>
	<div class='conceptbox' style='text-align: left'>
		<div class="box-header">Subquery {{ id }}</div>

		<pre v-show="false">
			Current concept: {{  current_concept }}
			Term search URL: <a :href="term_search_url">Hiero</a>
			Terms: {{  JSON.stringify(terms) }}
		</pre>

		<table>
			<tr>
				<td class="fn">
					<label :for="id + 'main_fields'">Field: </label>
				</td>
				<td>
					<SelectPicker data-width="100%" :data-id="id + 'main_fields'" v-model="search_field" :options="main_fields"/>
				</td>
			</tr>
			<tr>
				<td class="fn">
					<label :for="id + 'ac1'">Concept: </label></td>
				<td>
					<Autocomplete
						:id="id + 'ac1'"
						class="form-control"
						placeholder="...concept..."

						:processData="get_cluster_values"
						:url="completionURLForConcept"
						v-model="current_concept"
					/>
					<!-- <button @click="addConcept" title="Add concept to lexicon">⤿ lexicon</button> -->
				</td>
			</tr>
			<tr>
				<td class="fn"><label :for="id + 'ac2'">Term: </label></td>
				<td>
					<Autocomplete
						:id="id + 'ac2'"
						class="form-control"
						placeholder="...term..."
						:processData="get_term_values"
						:url="completionURLForTerm"
						v-model="current_term"
					/>
					<button @click="addTerm" title="Add term to lexicon">⤿ lexicon</button>
				</td>
			</tr>
		</table>


		<div class="terms">
			<div v-for="(t,i) in terms" :key="i">
				<label v-if="t.term">
					<input type="checkbox" v-model="checked_terms[t.term]" @click="() => toggleChecked(t.term)"/>
				{{ t.term }}</label>
			</div>
		</div>

		<button type="button" @click="buildQuery">Add selected terms to query</button>
		<button type="button" @click="resetQuery">Clear</button>
	 </div>
</template>

<script lang="ts">
import Vue from 'vue';

import axios from 'axios'
import Autocomplete from '@/components/Autocomplete.vue';
import * as CorpusStore from '@/store/search/corpus';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';
import { uniq, log_error } from './utils'

import SelectPicker from '@/components/SelectPicker.vue';

const requestHeaders = { 'headers': { 'Accept': 'application/json' }, 'auth': { 'username': 'user', 'password': 'password' } }
type Term = { term: string}
declare const USER_ID: string;

export default Vue.extend ( {
	name: 'ConceptSearchBox',
	components: { Autocomplete, SelectPicker },
	props: {
		id: String,
		field: String
	},
	data: () => ({
		debug: false,
		search_concept: '',
		search_field: '',
		search_term : '',
		current_concept : '',
		current_term : '',
		checked_terms: {} as Record<string, boolean>,
		fields: ['hallo', 'daar'] as string[],
		terms: [] as Term[],
		corpus: CorpusStore.getState().id,
		getters: ConceptStore.get,
		//server : 'http://localhost:8080/Oefenen/' as string,
		instance: 'quine_lexicon' as string,
		credentials :  {
			auth: {
				username: 'user',
				password: 'password'
			}
		}
	}),

	methods : {
		alert,
		buildQuery() {
			const terms = Object.keys(this.checked_terms).filter(t => this.checked_terms[t])
			const scq: ConceptStore.SingleConceptQuery = {
				terms: terms
					.filter(x=>x && x !== 'null')
					.map(t => ({field: 'lemma', value: t}))
			}
			try {
				// alert(JSON.stringify(scq))
				ConceptStore.actions.setSubQuery( {id: this.id, subquery: scq} )
			} catch (e) {
				alert('Whoops:' + e.message)
			}
		},

		toggleChecked(t: string) {
			Vue.set(this.checked_terms, t,  !this.checked_terms[t]);
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
		get_cluster_values(d: { data: ConceptStore.LexiconEntry[] }): string[] {
			const vals = uniq(d.data.map(x  => x.cluster))
			return vals
		},
		get_term_values(d: { 'data': ConceptStore.LexiconEntry[] }) {
			const vals = uniq(d.data.map(x => x.term))
			return vals
		},
		insertTerm() {
			if (!USER_ID) {
				alert('You need to be logged in to add terms to the lexicon')
				return
			}
			if (!this.settings) return;

			const insertIt = {
				corpus: this.corpus,
				field: this.search_field,
				concept: this.current_concept,
				term: this.current_term,
				author: 'corpus_frontend'
			}
			const insertTerm =  encodeURIComponent(JSON.stringify(insertIt))
			const url = `${this.settings.blackparank_server}/api?instance=${this.instance}&insertTerm=${insertTerm}`

			// TODO: authentication !!!!
			axios.get(url,{ auth: requestHeaders.auth })
				.then(r => console.log('inserted term'))
				.catch(log_error)
		},
		insertConcept() {
			if (!this.settings) return;
			const self = this
			const insertIt = {corpus: self.corpus, field: self.search_field, concept:self.current_concept, author: 'corpus_frontend'}
			const insertConcept =  encodeURIComponent(JSON.stringify(insertIt))
			const url = `${this.settings.blackparank_server}/api?instance=${this.instance}&insertConcept=${insertConcept}`

			// TODO: authentication !!!!
			axios.get(url,{ auth: requestHeaders.auth })
				.then(r => console.log('inserted concept'))
				.catch(log_error)
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
		settings: ConceptStore.get.settings,
		main_fields(): string[] {
			return ConceptStore.get.main_fields()
		},
		subquery_from_store(): ConceptStore.SingleConceptQuery { return ConceptStore.getState().query[this.id] },
		term_search_url(): string {
			if (!this.settings) return '';
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
			if (!this.settings) return Promise.resolve([]);
			const self = this
			const getTermsURL: string = this.term_search_url
			const autocompleteURL = `${this.settings.corpus_server}/${this.corpus}/autocomplete/contents/lemma/?term=${this.current_term}`

			console.log(`get Terms: ${getTermsURL}, autocomplete: ${autocompleteURL}`)
			const pdb = axios.get(getTermsURL)
			const termPromiseCorpus: Promise<string[]> = axios.get(autocompleteURL).then(r => r.data)
			const termPromiseDatabase: Promise<string[]>  = pdb.then(r => self.get_term_values(r.data))

			// alert(term_promise_database)

			const promiseBoth: Promise<string[]> = Promise.all([termPromiseDatabase, termPromiseCorpus]).then(r => {
				console.log(JSON.stringify(r))
				const r00 = r[0].filter(x => x)
				return r00.concat(r[1]).filter(x => x && x.length > 0) // dit gaat mis als er null in db stuk zit....
			})

			return promiseBoth
			// const terms_from_blacklab = axios.get(terms_from_blacklab_term_url)
		},

		completionURLForTerm(): string  {
			if (!this.settings) return '';
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
			if (!this.settings) return '';
			const field = this.search_field
			const concept = this.current_concept
			const wQuery = `
				query Quine {
					lexicon (cluster: "/^${concept}/", field: "${field}") {
						field,
						cluster,
						term
					}
				}`;
			//console.log("AUTOCOMPLETE query: " + JSON.stringify(wQuery).replace(/\\n/, '\n'))
			return `${this.settings.blackparank_server}/api?instance=${this.settings.blackparank_instance}&query=${encodeURIComponent(wQuery)}`
		},
	},
	watch: {
		main_fields(n, o) {
			if (n && n.length > 0)
				this.search_field = n[0]
		},
	},
	created() {
		this.$watch(() => ({
			search_field: this.search_field,
			current_concept: this.current_concept,
			term_search_url: this.term_search_url,
		}), ({search_field, current_concept, term_search_url}) => {
			const query: string = this.term_search_url as string
			axios.get(query, requestHeaders)
				.then(response => {
					console.log(`found in lexicon for field: "${this.search_field}", cluster: "${this.current_concept}"`  + JSON.stringify(response.data.data))
					this.terms = uniq(response.data.data)
					this.terms.map(t => this.checked_terms[t.term] = true)
					return response.data.data
				})
		})
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
	box-shadow: 10px 5px 5px grey;
	border-radius: 10px;
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
