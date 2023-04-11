<template>
	<div style='text-align: left'>
		Search in: <SelectPicker v-model="element_searched" :options="getters.settings().searchable_elements"/>

		<div class='boxes' style='text-align: center'>
			<ConceptSearchBox
				v-for="id in nBoxes"
				:key="id"
				:id="'b' + id"
				:ref="'b' +id"
			/>
		</div>
		<button @click.prevent="resetQuery">Reset</button>
		<button @click.prevent="addBox">Add box</button>
		<button @click.prevent="removeBox">Remove box</button>
		<button  target="_blank" @click="window.open(getters.settings().lexit_server + '?db=' + getters.settings().lexit_instance + '&table=lexicon', '_blank')">View lexicon</button>

		<label> <input type="checkbox" v-model="showQuery"> Show query</label>

		<div style="border: 1px solid black; margin-top: 1em; padding: 4pt" v-if="showQuery">
			Settings:
			<pre v-text="settings"></pre>

			<i>Query</i>

			<div style="margin-bottom: 1em" v-for="(e,i) in Object.entries(query_from_store)" v-bind:key="i">
				<b>{{ e[0] }}</b> → [{{ e[1].terms.filter(t => t.value.length > 0).map(t => t.value).join("; ")}}]
			</div>

			<i>CQL rendition</i>

			<div class="code" v-text="query_cql_from_store"></div>
		</div>

	</div>
</template>

<script lang="ts">

import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as PatternStore from '@/store/search/form/patterns';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';

import SelectPicker from '@/components/SelectPicker.vue';

import debug from '@/utils/debug';


import ConceptSearchBox from './ConceptSearchBox.vue'

export default Vue.extend ({
	components: { ConceptSearchBox, SelectPicker },
	name: 'ConceptSearch',
	props: {
		msg: String,
		src : String
	},

	data: () => ({
		debug: false,
		showQuery : false,
		corpus: CorpusStore.getState().id,
		search_in_options: ConceptStore.get.settings().searchable_elements,  //,c2e[CorpusStore.getState().id],
		search_in: 'p',
		nBoxes: 2,
		queries : { // this should be a computed field.....

		},
		queryFieldValue: '',
		filterFieldValue: '', // TODO moet weg....
		cqlQuery: '',
		getters: ConceptStore.get,
		window: window as Window
	}),

	methods : {
		addBox() {
			this.nBoxes++;
		},
		removeBox() {
			this.nBoxes--;
		},
		resetQuery() {
			Object.keys(this.$refs).forEach(k => {
				const ref_k = this.$refs[k]
				//console.log(rk)
				ref_k[0].resetQuery()
			})
			ConceptStore.actions.resetQuery()
		}
	},
	computed : {
		settings: ConceptStore.get.settings,
		query_from_store() { return ConceptStore.getState().query },
		query_cql_from_store() { return ConceptStore.getState().query_cql },
		request_from_store() { return ConceptStore.get.translate_query_to_cql_request() },

		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},
		element_searched: {
			get(): string|null { return ConceptStore.getState().target_element; },
			set: ConceptStore.actions.setTargetElement,
		},
	},
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
