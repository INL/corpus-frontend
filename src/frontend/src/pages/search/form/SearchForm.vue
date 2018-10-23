<template>
	<form class="col-xs-12 contentbox" id="mainForm"> <!-- TODO id -->
		<div class="row">

			<Annotations class="col-xs-12 col-md-6" id="searchcontainer"/> <!-- todo id -->
			<Filters class="col-xs-12 col-md-6" id="filtercontainer"/>

			<div class="col-xs-12">
				<hr>
				<div style="display:inline-block; position: absolute; bottom: 0;">
					<button type="submit" class="btn btn-primary btn-lg">Search</button>
					<button type="reset" class="btn btn-default btn-lg" title="Start a new search">Reset</button>
				</div>

				<button type="button" class="btn btn-lg btn-default pull-right" data-toggle="modal" data-target="#settingsModal"><span class="glyphicon glyphicon-cog" style="vertical-align:text-top;"></span></button>
			</div>
		</div>

	</form>
</template>

<script lang="ts">
import Vue from 'vue';

import $ from 'jquery';

import Annotations from '@/pages/search/form/Annotations.vue';
import Filters from '@/pages/search/form/Filters.vue';

export default Vue.extend({
	components: {
		Filters,
		Annotations,
	},
	props: {
		afterMount: Object as any
	},
	mounted() {
		console.log('inside searchform component mounted')
		$(document).trigger('form-mounted');
	}
})

</script>

<style lang="scss">

</style>