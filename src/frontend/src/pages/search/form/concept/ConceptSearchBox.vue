<template>
	<div class='conceptbox' style='text-align: left'>
		<div class="box-header">Subquery {{ id }}</div>

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
						:url="urls && urls.completionURLForConcept"
						v-model="current_concept"
					/>
					<!-- <button @click="insertConcept" title="Add concept to lexicon">⤿ lexicon</button> -->
				</td>
			</tr>
			<tr>
				<td class="fn"><label :for="id + 'ac2'">Term: </label></td>
				<td>
					<div class="input-group">
						<Autocomplete
							class="form-control"
							placeholder="...term..."
							:id="id + 'ac2'"
							:getData="get_term_values"
							v-model="current_term"
						/>

						<div class="input-group-btn">
							<button @click="insertTerm" title="Add term to lexicon" class="btn btn-default">⤿ lexicon</button>
						</div>
					</div>
				</td>
			</tr>
		</table>


		<div class="terms">
			<div v-for="(t,i) in terms" :key="i">
				<label v-if="t.term">
					<input type="checkbox" :value="t.term" v-model="checked_terms[t.term]"/>
					{{ t.term }}
				</label>
			</div>
		</div>

		<button type="button" @click="resetQuery" class="btn btn-sm btn-default">Clear</button>
	 </div>
</template>

<script lang="ts">
import Vue from 'vue';

import axios from 'axios'
import qs from 'qs';

import Autocomplete from '@/components/Autocomplete.vue';
import * as CorpusStore from '@/store/search/corpus';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';
import { uniq, log_error } from './utils'

import SelectPicker from '@/components/SelectPicker.vue';
import { blacklabPaths } from '@/api';
import { queueScheduler } from 'rxjs';

// see header.vm
declare const USERNAME: string;
declare const PASSWORD: string;
const credentials = USERNAME && PASSWORD ? {
	username: USERNAME,
	password: PASSWORD
} : null;

type Term = { term: string }

export default Vue.extend ( {
	name: 'ConceptSearchBox',
	components: { Autocomplete, SelectPicker },
	props: {
		id: String,
		field: String,
		settings: Object as () => ConceptStore.Settings,
		value: Array as () => Array<{field: string, value: string}>
	},
	data: () => ({
		debug: false,
		search_field: '',
		current_concept : '',
		current_term : '',
		checked_terms: {} as Record<string, boolean>,
		terms: [] as Term[],
		corpus: CorpusStore.getState().id,
		quine_lexicon: 'quine_lexicon' as string,
	}),

	methods : {
		alert,
		addTerm() {
			if (!this.current_term || this.terms.find(t => t.term === this.current_term)) {
				return;
			}
			this.terms.push({'term': this.current_term});
			this.insertTerm();
		},
		get_cluster_values(d: { data: ConceptStore.LexiconEntry[] }): string[] {
			const vals = uniq(d.data.map(x  => x.cluster))
			return vals
		},
		get_term_values(term: string): Promise<string[]> {
			if (!term) return Promise.resolve([]);
			const getTermsURL: string = this.term_search_url as string // this is correct.
			if (!getTermsURL) {
				return Promise.resolve([]);
			}
			const mainAnnotation = CorpusStore.get.firstMainAnnotation();
			// FIXME: hardcoded searching in lemma. Should be configurable
			const getTermsFromBlackLabUrl = blacklabPaths.autocompleteAnnotation(CorpusStore.getState().id, mainAnnotation.annotatedFieldId, 'lemma');

			return Promise.all([
				axios.get<{data: ConceptStore.LexiconEntry[]}>(getTermsURL, {
					withCredentials: true,
					paramsSerializer: params => qs.stringify(params)
				}).then(r => r.data.data.map(d => d.term).filter(t => !!t)),
				axios.get<string[]>(getTermsFromBlackLabUrl, {
					withCredentials: true,
					params: { term }
				}).then(r => r.data)
			]).then(([pdb, corpus]) => uniq([...pdb, ...corpus]))
		},
		insertConcept() {
			if (!this.current_concept) return;
			this.addToDatabase(this.current_concept);
		},
		insertTerm() {
			if (!this.current_term || this.checked_terms[this.current_term]) return;
			this.$set(this.checked_terms, this.current_term, true);
			this.addToDatabase(this.current_concept, this.current_term);
		},
		addToDatabase(concept: string, term?: string) {
			if (!this.settings) return;
			if (!credentials) {
				alert('You need to be logged in to add terms to the lexicon')
				return
			}
			const insertIt: any = {
				corpus: this.corpus,
				field: this.search_field,
				author: credentials.username,
				concept: this.current_concept,
			}
			if (term) insertIt.term = term

			const insertTerm =  encodeURIComponent(JSON.stringify(insertIt))
			const url = `${this.settings.concept_server}/api?instance=${this.quine_lexicon}&insertTerm=${insertTerm}`

			axios.get(url,{ auth: credentials })
				.then(r => console.log('inserted term'))
				.catch(log_error)
		},
		resetQuery() {
			this.current_concept = ''
			this.current_term = ''
			this.terms = []
			this.checked_terms = {}
		}
	},

	computed : {
		main_fields: ConceptStore.get.main_fields,

		newValue(): ConceptStore.AtomicQuery[] {
			return Object
			.keys(this.checked_terms)
			.filter(t => this.checked_terms[t] && t !== 'null')
			.map(t => ({field: 'lemma', value: t})); // TODO don't hardcode lemma!.
		},
		term_search_url(): string|null {
			return this.urls && this.urls.term_search_url;
		},
		completionURLForTerm(): string|null {
			return this.urls && this.urls.completionURLForTerm;
		},
		completionURLForConcept(): string|null {
			return this.urls && this.urls.completionURLForConcept;
		},
		urls(): {
			term_search_url: string|null,
			completionURLForTerm: string|null,
			completionURLForConcept: string|null,
		} | null {
			if (!this.settings) return null;

			const field = this.search_field;
			const concept = this.current_concept;
			const term = this.current_term;
			return {
				// NOTE: different instances!
				term_search_url: field && concept ?
					`${this.settings.concept_server}/api?instance=${this.quine_lexicon}&query=${encodeURIComponent(
						`query Quine { lexicon (field: "${field}", cluster: "${concept}") { field, cluster, term } }`
					)}` : null,
				completionURLForTerm: term && field && concept ?
					`${this.settings.concept_server}/api?instance=${this.settings.blackparank_instance}&query=${encodeURIComponent(
						`query Quine { lexicon (term: "/^${term}/", field: "${field}", cluster: "${concept}") { field, cluster, term } }`
					)}` : '',
				completionURLForConcept: field && concept ?
					`${this.settings.concept_server}/api?instance=${this.settings.blackparank_instance}&query=${encodeURIComponent(
						`query Quine { lexicon (cluster: "/^${concept}/", field: "${field}") { field, cluster, term } }`
					)}` : null,
			}
		},
	},
	watch: {
		main_fields(n, o) {
			if (n && n.length > 0)
				this.search_field = n[0]
		},
		term_search_url() {
			const url = this.term_search_url;
			if (!url || !credentials) return;

			axios.get(url, {
				headers: { 'Accept': 'application/json', },
				auth: credentials
			})
			.then(response => {
				console.log(`found in lexicon for field: "${this.search_field}", cluster: "${this.current_concept}"`  + JSON.stringify(response.data.data))
				this.terms = uniq(response.data.data)
				this.terms.map(t => this.$set(this.checked_terms, t.term, true))
			})
		},
		newValue() {
			// don't remove the type cast, so we get a warning here if we change something.
			this.$emit('input', this.newValue as ConceptStore.AtomicQuery[]);
		},
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

tr {
	border-spacing: 0 10px;
	border-collapse: separate;
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
