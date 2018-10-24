<template>
	<div>
		<SearchForm class="row contentbox" id="mainForm"/>
		<QuerySummary v-if="viewedResults" class="row contentbox" id="summary"/>
		<Results v-show="viewedResults" class="row contentbox" id="results"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import $ from 'jquery';

import * as RootStore from '@/store';

import SearchForm from '@/pages/search/form/SearchForm.vue';
import QuerySummary from '@/pages/search/QuerySummary.vue';
import Results from '@/pages/search/Results.vue';


export default Vue.extend({
	components: {
		SearchForm,
		QuerySummary,
		Results
	},
	computed: {
		viewedResults: RootStore.get.viewedResults
	},

	mounted() {
		$(document).trigger('vue-root-mounted');
	}
})

</script>

<style lang="scss">

</style>