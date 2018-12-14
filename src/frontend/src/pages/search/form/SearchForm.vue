<template>
	<form class="row" @submit.prevent.stop="submit" @reset.prevent.stop="reset">
		<Annotations :class="['col-xs-12', {'col-md-6': !isQueryBuilderActive && filtersVisible}]" id="searchcontainer"/>
		<div v-if="filtersVisible" class="col-xs-12 visible-xs visible-sm"><hr/></div>
		<Filters v-show="filtersVisible" :class="`col-xs-12 ${isQueryBuilderActive ? 'col-md-9' : 'col-md-6'}`" id="filtercontainer"/>

		<div class="col-xs-12">
			<hr>
			<div style="display:inline-block; position: absolute; bottom: 0;">
				<button type="submit" class="btn btn-primary btn-lg">Search</button>
				<button type="reset" class="btn btn-default btn-lg" title="Start a new search">Reset</button>
			</div>

			<button type="button" class="btn btn-lg btn-default pull-right" data-toggle="modal" data-target="#settingsModal"><span class="glyphicon glyphicon-cog" style="vertical-align:text-top;"></span></button>
		</div>

		<SearchFormSettings id="settingsModal"/>
	</form>
</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';

import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';
import * as ResultsStore from '@/store/results';
import * as FormStore from '@/store/form';

import Annotations from '@/pages/search/form/Annotations.vue';
import Filters from '@/pages/search/form/Filters.vue';
import SearchFormSettings from '@/pages/search/form/SearchFormSettings.vue';

export default Vue.extend({
	components: {
		Filters,
		Annotations,
		SearchFormSettings
	},
	props: {
		afterMount: Object as any
	},
	computed: {
		isQueryBuilderActive(): boolean { return RootStore.get.queryBuilderActive(); },
		filtersVisible(): boolean { return RootStore.get.filtersActive(); }
	},
	methods: {
		reset() {
			RootStore.actions.reset();
			return false;
		},
		submit() {
			RootStore.actions.searchFromSubmit();
		}
	}
})

</script>

<style lang="scss">

#searchContainer, #filterContainer {
	-webkit-transition: all 0.5s ease;
	-moz-transition: all 0.5s ease;
	-o-transition: all 0.5s ease;
	transition: all 0.5s ease;
}


#filterContainer>.tab-content {
	max-height: 500px;
	overflow-y: auto;
	overflow-x: hidden;
	/* required due to negative margin-right of contents causing scrollbar otherwise */
}

</style>
