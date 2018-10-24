<template>
	<form>
		<div class="col-xs-12">
			<h2>{{title}}</h2>
			<a v-if="showHomeLink" :href="homeLink" id="corpora-link">Back to my corpora</a>
		</div>

		<Annotations class="col-xs-12 col-md-6" id="searchcontainer"/>
		<Filters class="col-xs-12 col-md-6" id="filtercontainer"/>

		<div class="col-xs-12">
			<hr>
			<div style="display:inline-block; position: absolute; bottom: 0;">
				<button type="submit" class="btn btn-primary btn-lg">Search</button>
				<button type="reset" class="btn btn-default btn-lg" title="Start a new search">Reset</button>
			</div>

			<button type="button" class="btn btn-lg btn-default pull-right" data-toggle="modal" data-target="#settingsModal"><span class="glyphicon glyphicon-cog" style="vertical-align:text-top;"></span></button>
		</div>
	</form>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';

import Annotations from '@/pages/search/form/Annotations.vue';
import Filters from '@/pages/search/form/Filters.vue';

declare const PATH_TO_TOP: string; // TODO

export default Vue.extend({
	components: {
		Filters,
		Annotations,
	},
	props: {
		afterMount: Object as any
	},
	computed: {
		title(): string { return CorpusStore.getState().displayName; },
		showHomeLink(): boolean { return true; }, //return CorpusStore.getState().owner != null; },
		homeLink(): string { return PATH_TO_TOP; }
	}
})

</script>

<style lang="scss">

</style>