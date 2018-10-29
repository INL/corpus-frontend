<template>
	<div v-if="filters.length">
		<span class="filter-overview">
			<span v-for="filter in filters" :key="filter.id">{{filter.displayName}}: <i>{{filter.values.join(', ')}}</i>&nbsp;</span>
		</span>
		<div class="text-muted text-small sub-corpus-size">
			<template v-if="results && isDone">
				Total documents: {{results.summary.numberOfDocs}}<br>
				Total tokens: {{results.summary.tokensInMatchingDocuments}}
			</template>
			<template v-else>
				<span class="fa fa-spinner fa-spin searchIndicator totals-spinner"></span><!-- todo -->
				Calculating number of documents...
			</template>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import StatisticsBaseComponent from '@/components/StatisticsBase.vue';

import * as formStore from '@/store/form';
import * as corpusStore from '@/store/corpus';

import {getFilterString} from '@/modules/singlepage-bls';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

type ExtendedFilter = {
	id: string;
	values: string[];
	displayName: string;
}

export default StatisticsBaseComponent.extend({
	computed: {

		// whatever, this will be cached.
		// todo tidy up
		metadataValueMaps(): {[fieldId: string]: {[value: string]: string; }} {
			return Object.values(corpusStore.getState().metadataFields)
			.reduce((acc, field: AppTypes.NormalizedMetadataField) => {
				acc[field.id] = (field.values || [])!.reduce((acc, val) => {
					acc[val.value] = val.label;
					return acc;
				}, {} as {[key: string]: string})
				return acc;
			}, {} as {[key:string]: {[key: string]: string}})
		},

		filters(): ExtendedFilter[] {
			const metadataFields = corpusStore.getState().metadataFields;
			return formStore.get.activeFilters().map(f => {
				const {displayName} = metadataFields[f.id];

				const displayValues = this.metadataValueMaps[f.id] || {};

				return {
					...f,
					displayName,
					values: f.values.map(value => displayValues[value] != null ? displayValues[value] : value)
				}
			})
		},
	},
	methods: {
		isDone(): boolean {
			return this.filters.length === 0 || (this.results != null && !this.results.summary.stillCounting)
		},
		getNextRequestParams(): BLTypes.BlacklabParameters {
			return {
				number: 0,
				first: 0,
				filter: getFilterString({
					pattern: null,
					filters: formStore.get.activeFilters()
				}),
				includetokencount: true
			}
		}
	},
	watch: {
		// TODO debounce & delay
		filters() {
			this.results = null;
			this.stop();
			this.start();
		}
	}
});

</script>

<style lang="scss" scoped>
.filter-overview {
	color: #888888;
	font-size: 85%;
	padding-left: 1px;
}
.sub-corpus-size {
	font-size: 85%;
	padding-left: 15px;
	padding-top: 5px;
}
</style>