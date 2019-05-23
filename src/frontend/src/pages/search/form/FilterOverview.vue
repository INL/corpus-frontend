<template>
	<div class="filter-overview">
		<div v-for="filter in activeFilters" :key="filter.id">
			{{filter.displayName}}: <i>{{filter.summary}}</i>
		</div>

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
				<span class="fa fa-spinner fa-spin searchIndicator totals-spinner"></span>
				Calculating size of selected subcorpus...
			</template>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import {Subscription, Notification} from 'rxjs';

import * as CorpusStore from '@/store/search/corpus';
import * as FilterStore from '@/store/search/form/filters';

import { selectedSubCorpus$ } from '@/store/search/streams';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';
import {ApiError} from '@/api';
import {getFilterSummary} from '@/utils';

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
		activeFilters: FilterStore.get.activeFilters,

		totalCorpusTokens(): number { return CorpusStore.getState().tokenCount; },
		totalCorpusDocs(): number { return CorpusStore.getState().documentCount; }
	},
	created() {
		this.subscriptions.push(selectedSubCorpus$.subscribe(v => {
			this.subCorpusStats = v.value || null;
			this.error = v.error || null;
		}));
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