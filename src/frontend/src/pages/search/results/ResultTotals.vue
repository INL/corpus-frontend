<template>
<div class="totals">
	<div class="totals-text" :title="percentOfSearchSpaceClarification">
		Total {{resultType}}: {{resultCount.toLocaleString()}}<template v-if="isCounting">&hellip;</template><template v-if="searchSpaceCount !== -1 /* see corpus store documentCount property */"> ({{this.resultCount / this.searchSpaceCount | frac2Percent}})</template><br>
		<template v-if="isGroups">
		Total groups: {{groupCount.toLocaleString()}}<template v-if="isCounting">&hellip;</template><br>
		</template>
		<!-- Total {{resultType}}: {{resultCount}}<template v-if="isCounting">&hellip;</template> {{percentOfTotal}}<br> -->
		Total pages: {{pageCount.toLocaleString()}}<template v-if="isCounting">&hellip;</template>
	</div>
	<span v-show="isCounting || subCorpusStats == null" class="fa fa-spinner fa-spin searchIndicator totals-spinner"/>

	<template v-if="error">
		<div class="text-danger text-center totals-warning" style="cursor: pointer;" @click="start" :title="`${error.message} (click to retry)`">
			<span class="fa fa-exclamation-triangle text-danger"/><br>
			Network error!
		</div>
	</template>
	<template v-else-if="tooManyResults">
		<div class="text-danger text-center totals-warning" style="cursor: pointer;" @click="start" title="Click to continue counting">
			<span class="fa fa-exclamation-triangle text-danger"/><br>
			Too many results!
		</div>
	</template>
</div>
</template>


<script lang="ts">
import StatisticsBaseComponents from '@/components/StatisticsBase.vue';

import * as Api from '@/api';

import { submittedSubcorpus$ } from '@/store/streams';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import frac2Percent from '@/mixins/fractionalToPercent';

const refreshRate = 1_000;
const pauseAfterResults = 1_000_000; // TODO time-based pausing, see https://github.com/INL/corpus-frontend/issues/164

export default StatisticsBaseComponents.extend({
	filters: { frac2Percent },
	subscriptions: {
		subCorpusStats: submittedSubcorpus$
	},
	computed: {
		pageCount(): number { return Math.ceil((this.isGroups ? this.groupCount : this.resultCount) / this.initialResults.summary.searchParam.number); },
		isCounting(): boolean { return this.error == null && this.results!.summary.stillCounting; },
		tooManyResults(): boolean { return (this.results!.summary as any).stoppedCountingHits; }, // if property missing, not too many results? TODO clarify these stopped/still variables with Jan and document in type.

		isGroups(): boolean { return BLTypes.isGroups(this.results); },
		groupCount(): number { return BLTypes.isGroups(this.results) ? this.results.summary.numberOfGroups : 0; },

		resultType(): string { return BLTypes.isHitGroupsOrResults(this.results) ? 'hits' : 'documents'; },
		/** This is just a display value, it returns the number of groups if the results are grouped */
		resultCount(): number { return BLTypes.isHitGroupsOrResults(this.results) ? this.results.summary.numberOfHits : this.results!.summary.numberOfDocs; },

		searchSpaceType(): string { return BLTypes.isHitGroupsOrResults(this.results) ? 'tokens' : 'documents'; },
		/** The total number of relevant items in the searched subcorpus, tokens if viewing tokens, docs if viewing documents */
		searchSpaceCount(): number {
			const stats: BLTypes.BLDocResults|null = (this as any).subCorpusStats;
			if (!stats) {
				return -1;
			}

			return BLTypes.isHitGroupsOrResults(this.results) ? stats.summary.tokensInMatchingDocuments! : stats.summary.numberOfDocs;
		},
		percentOfSearchSpaceClarification(): string {
			const stats: BLTypes.BLDocResults|null = (this as any).subCorpusStats;
			if (!stats) {
				return '';
			}

			return `Matched ${this.resultCount.toLocaleString()} ${this.resultType} in a total of ${this.searchSpaceCount.toLocaleString()} ${this.searchSpaceType} in the searched subcorpus.`;
		}
	},
	methods: {
		isDone(): boolean { return this.results == null || this.tooManyResults || !this.isCounting; },
		getNextRequestParams(): BLTypes.BLSearchParameters {
			return {
				...this.results!.summary.searchParam,
				number: 0,
				first: 0,
			}
		},
	},
});
</script>

<style lang="scss">

.totals {
	color: #888;
	font-size: 85%;
	display: flex;
	align-items: center;
}

.totals-text {
	order: 2;
}

.totals-warning {
	margin: 0px 10px;
	> .fa {
		font-size: 20px;
	}
}

.searchIndicator.totals-spinner {
	order: 1;
	font-size: 16px;
	padding: 4px;
	margin: 0px 10px;
}

</style>