<template>
	<div>
		<ul class="nav nav-tabs cf-panel-tab-header cf-panel-lg">
			<li :class="{'active': activeForm==='search'}" @click.prevent="activeForm='search'"><a href="#form-search">Search</a></li>
			<li :class="{'active': activeForm==='explore'}" @click.prevent="activeForm='explore'"><a href="#form-explore">Explore</a></li>
		</ul>
		<form class="tab-content cf-panel-tab-body cf-panel-lg clearfix" style="padding-top: 0;" @submit.prevent.stop="submit" @reset.prevent.stop="reset">
			<QueryFormSearch  id="form-search" v-show="activeForm === 'search'"
				:class="{
					'col-xs-12': true,
					'col-md-6': filtersVisible && !queryBuilderVisible
				}"
			/>
			<QueryFormExplore id="form-explore" v-show="activeForm === 'explore'"
				:class="{
					'col-xs-12': true
				}"
			/>

			<!-- TODO this is a bit dumb, only show the hr when the filters and pattern form are below each other, but that's rather conditional... -->
			<div v-if="filtersVisible"
				:class="{
					'col-xs-12': true,
			 		'visible-xs': true,
					'visible-sm': true,
					'visible-md': queryBuilderVisible || this.activeForm === 'explore',
					'visible-lg': queryBuilderVisible || this.activeForm === 'explore'
				}"
			>
				<hr/>
			</div>
			<QueryFormFilters id="filtercontainer" v-show="filtersVisible"
				:class="{
					'col-xs-12': true,
					'col-md-6': !queryBuilderVisible,
					'col-md-9': queryBuilderVisible
				}"
			/>
			<div class="col-xs-12">
				<hr/>
				<button type="submit" class="btn btn-primary btn-lg">Search</button>
				<button type="reset" class="btn btn-default btn-lg" title="Start a new search">Reset</button>
				<button type="button" class="btn btn-lg btn-default" data-toggle="modal" data-target="#settings"><span class="glyphicon glyphicon-cog" style="vertical-align:text-top;"></span></button>
			</div>
		</form>
		<QueryFormSettings />
	</div>

</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';

import * as RootStore from '@/store';
import * as InterfaceStore from '@/store/form/interface';

import QueryFormSearch from '@/pages/search/form/QueryFormSearch.vue';
import QueryFormExplore from '@/pages/search/form/QueryFormExplore.vue';
import QueryFormFilters from '@/pages/search/form/QueryFormFilters.vue';
import QueryFormSettings from '@/pages/search/form/QueryFormSettings.vue';

export default Vue.extend({
	components: {
		QueryFormExplore,
		QueryFormSearch,
		QueryFormFilters,
		QueryFormSettings,
	},
	computed: {
		queryBuilderVisible(): boolean { return RootStore.get.queryBuilderActive(); },
		filtersVisible(): boolean { return RootStore.get.filtersActive(); },
		activeForm: {
			get: InterfaceStore.get.form,
			set: InterfaceStore.actions.form
		},
	},
	methods: {
		reset: RootStore.actions.reset,
		submit: RootStore.actions.searchFromSubmit,
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
