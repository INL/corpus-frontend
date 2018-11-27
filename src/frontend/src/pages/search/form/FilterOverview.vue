<template>
	<div class="text-muted text-small filter-overview">
		<span v-for="filter in filters" :key="filter.id">{{filter.displayName}}: <i>{{filter.values.join(', ')}}</i>&nbsp;</span>

		<div class="sub-corpus-size">
			<template v-if="error">
				Error: {{error.message}}
			</template>
			<template v-else-if="subCorpusStats">
				Selected subcorpus:<br>
				<span style="display: inline-block; vertical-align:top;">
					Total documents:<br>
					Total tokens:
				</span>
				<span style="display: inline-block; vertical-align:top; text-align: right; font-family: monospace;">
					 {{subCorpusStats.summary.numberOfDocs.toLocaleString()}}<br>
					 {{subCorpusStats.summary.tokensInMatchingDocuments.toLocaleString()}}
				</span>
				<span style="display: inline-block; vertical-align:top; text-align: right; font-family: monospace;">
					 ({{ subCorpusStats.summary.numberOfDocs / totalCorpusDocs | frac2Percent }})<br>
					 ({{ subCorpusStats.summary.tokensInMatchingDocuments / totalCorpusTokens | frac2Percent }})
				</span>
			</template>
			<template v-else>
				<span class="fa fa-spinner fa-spin searchIndicator totals-spinner"></span><!-- todo spinner classes -->
				Calculating size of selected subcorpus...
			</template>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import {Subscription} from 'rxjs';

import * as formStore from '@/store/form';
import * as corpusStore from '@/store/corpus';

import { selectedSubCorpus$ } from '@/store/streams';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import {ApiError} from '@/api';

import frac2Percent from '@/mixins/fractionalToPercent';

type ExtendedFilter = {
	id: string;
	values: string[];
	displayName: string;
}

export default Vue.extend({
	filters: {
		frac2Percent
	},
	data: () => ({
		subscriptions: [] as Subscription[],
		subCorpusStats: null as null|BLTypes.BLDocResults,
		error: null as null|ApiError,
	}),
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

		totalCorpusTokens(): number { return corpusStore.getState().tokenCount; },
		totalCorpusDocs(): number { return corpusStore.getState().documentCount; }
	},
	created() {
		this.subscriptions.push(selectedSubCorpus$.subscribe(
			v => {
				this.subCorpusStats = v;
				this.error = null;
			},
			e => {
				this.subCorpusStats = null;
				this.error = e
			}
		))
	},
	destroyed() {
		this.subscriptions.forEach(s => s.unsubscribe());
	}
});

</script>

<style lang="scss" scoped>
.filter-overview {
	color: #888888;
	font-size: 85%;
	padding-left: 1px;
	margin-top: 20px;
}
.sub-corpus-size {
	margin-top: 10px;
	margin-left: 10px;
}
</style>