<template>
	<div class="row">
		<span v-if="isLoading || !document" class="fa fa-spinner fa-spin text-center" style="font-size: 60px; display: block; margin: auto;"></span>
		<div v-else-if="error" class="text-center">
			<h3 class="text-danger"><em>{{error.message}}</em></h3>
			<br>
			<button type="button" class="btn btn-lg btn-default" @click="fetch">Retry</button>
		</div>
		<h4 v-else-if="!anythingToShow" class="text-muted text-center"><em>
			No statistics have been configured for this corpus.
		</em></h4>

		<template v-else>

			<div v-if="statisticsTableData"
				:class="{
					'col-xs-12': true,
					'col-md-6': !!statisticsTableData
				}"
			>
				<table class="table" style="table-layout: auto; width: 100%;">
					<thead>
						<tr><th colspan="2" class="text-center">Document Statistics</th></tr>
					</thead>
					<tbody>
						<tr v-for="(value, key) in statisticsTableData" :key="key">
							<td><strong>{{key}}</strong> </td><td>{{value}}</td>
						</tr>
					</tbody>
				</table>
			</div>

			<AnnotationDistributions v-if="snippet"
				:class="{
					'col-xs-12': true,
					'col-md-6': !!statisticsTableData
				}"
				:snippet="snippet"
			/>

			<AnnotationGrowths v-if="snippet" class="col-xs-12" :snippet="snippet" />
		</template>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store/article';
import {blacklab} from '@/api';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import AnnotationDistributions from '@/pages/article/AnnotationDistributions.vue';
import AnnotationGrowths from '@/pages/article/AnnotationGrowths.vue';

export default Vue.extend({
	components: {
		AnnotationDistributions,
		AnnotationGrowths,
	},
	data: () => ({
		snippet: null as null|BLTypes.BLHitSnippet,
		error: null as null|AppTypes.ApiError,

		isLoading: false,
	}),
	computed: {
		document: RootStore.get.document,
		getStatistics: RootStore.get.statisticsTableFn,
		statisticsTableData() {
			return (this.getStatistics && this.document && this.snippet) ?
				this.getStatistics(this.document, this.snippet) : null;
		},
		anythingToShow(): boolean {
			return !!(
				RootStore.get.statisticsTableFn() ||
				RootStore.get.distributionAnnotation() ||
				RootStore.get.growthAnnotations()
			);
		}
	},
	methods: {
		fetch() {
			if (this.isLoading || !this.document) {
				return;
			}

			this.isLoading = true;
			this.error = null;
			this.snippet = null;

			blacklab.getSnippet(RootStore.getState().indexId, RootStore.getState().docId, 0, this.document.docInfo.lengthInTokens, 0)
			.then(snippet => this.snippet = snippet)
			.catch(error => this.error = error)
			.finally(() => this.isLoading = false);
		},
	},
	watch: {
		document() { this.fetch(); }
	},
	created() {
		this.fetch();
	}
});

</script>
