<template>
	<form @submit.prevent.stop="submit" @reset.prevent.stop="reset">

		<div class="col-xs-12">
			<h2 id="corpus-title">{{title}}</h2>
			<a v-if="showHomeLink" :href="homeLink" id="corpora-link">Back to my corpora</a>
		</div>

		<Annotations :class="['col-xs-12', {'col-md-6': !isQueryBuilderActive}]" id="searchcontainer"/>
		<Filters :class="`col-xs-12 ${isQueryBuilderActive ? 'col-md-9' : 'col-md-6'}`" id="filtercontainer"/>

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
import URI from 'urijs';

import * as CorpusStore from '@/store/corpus';
import * as RootStore from '@/store';
import * as ResultsStore from '@/store/results';
import * as FormStore from '@/store/form';

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
		showHomeLink(): boolean { return CorpusStore.getState().owner != null; },
		homeLink(): string { return PATH_TO_TOP; },
		isQueryBuilderActive(): boolean { return FormStore.getState().activePattern === 'queryBuilder'; }
	},
	methods: {
		reset() {
			RootStore.actions.reset();

			// TODO handle centrally and properly, also see ResultsView.vue
			const url = new URI();
			const newUrl = url.search('').segmentCoded(url.segmentCoded().filter(s => s !== 'hits' && s !== 'docs'));

			history.pushState(JSON.parse(JSON.stringify(Object.assign({}, RootStore.getState(), {corpus: undefined, history: undefined}))), '', newUrl.toString());

			return false;
		},
		submit() {
			ResultsStore.actions.resetPage();
			ResultsStore.actions.resetGroup();
			RootStore.actions.search();
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

#corpus-title {
	text-transform: capitalize;
	margin: 10px 0 0;
}

#corpora-link {
	display: inline-block;
	margin: 10px 0px;
	position: relative;

	&:before {
		content: "«";
		position: absolute;
		left: -12px;
	}
}

</style>