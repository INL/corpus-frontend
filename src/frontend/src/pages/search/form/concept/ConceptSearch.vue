<template>
	<div v-if="settings" style='text-align: left'>
		Search in: <SelectPicker v-model="element_searched" :options="settings.searchable_elements" />

		<div class='boxes' style='text-align: center'>
			<ConceptSearchBox v-for="(v, id) in query_from_store"
				:key="id"
				:id="'b' + id"
				:settings="settings"

				:value="v"
				@input="updateSubquery(id, $event)"
			/>
		</div>
		<button @click.prevent="resetQuery">Reset</button>
		<button @click.prevent="addBox">Add box</button>
		<button @click.prevent="removeBox">Remove box</button>
		<a role="button" class="btn" target="_blank" :href="settings.lexit_server + '?db=' + settings.lexit_instance + '&table=lexicon'">View lexicon</a>


		<label> <input type="checkbox" v-model="showQuery"> Show query</label>

		<div style="border: 1px solid black; margin-top: 1em; padding: 4pt" v-if="showQuery">
			Settings:
			<pre v-text="settings"></pre>

			<i>Query</i>

			<div style="margin-bottom: 1em" v-for="subquery, i in query_from_store" v-bind:key="i">
				<b>b{{i}}</b> → [{{ subquery.map(t => t.value).join("; ")}}]
			</div>

			<i>CQL rendition</i>

			<div class="code" v-text="query_cql_from_store"></div>
		</div>

	</div>
</template>

<script lang="ts">

import Vue from 'vue';

import * as PatternStore from '@/store/search/form/patterns';
import * as ConceptStore from '@/pages/search/form/concept/conceptStore';

import SelectPicker from '@/components/SelectPicker.vue';
import ConceptSearchBox from './ConceptSearchBox.vue'

export default Vue.extend ({
	components: { ConceptSearchBox, SelectPicker },
	name: 'ConceptSearch',
	data: () => ({
		showQuery : false,
	}),
	computed : {
		settings: ConceptStore.get.settings,
		query_from_store() { return ConceptStore.getState().query },
		query_cql_from_store() { return ConceptStore.getState().query_cql },

		concept: {
			get(): string|null { return PatternStore.getState().concept; },
			set: PatternStore.actions.concept,
		},
		element_searched: {
			get(): string|null { return ConceptStore.getState().target_element; },
			set: ConceptStore.actions.setTargetElement,
		},
	},

	methods : {
		updateSubquery(index: number, query: ConceptStore.AtomicQuery[]) {
			ConceptStore.actions.updateSubquery({index, query});
		},
		addBox() { ConceptStore.actions.addSubquery(undefined); },
		removeBox() { ConceptStore.actions.removeSubquery(undefined); },
		resetQuery() { ConceptStore.actions.resetQuery(); },
	}
});

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
