<template>
<div class="totals">
	<div class="totals-text">
		Total {{resultType}}: {{resultCount}}<template v-if="isCounting">&hellip;</template><br>
		Total pages: {{pageCount}}<template v-if="isCounting">&hellip;</template>
	</div>
	<span v-show="isCounting" class="fa fa-spinner fa-spin searchIndicator totals-spinner"/>

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

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

const refreshRate = 1_000;
const pauseAfterResults = 1_000_000; // TODO time-based pausing, see https://github.com/INL/corpus-frontend/issues/164

export default StatisticsBaseComponents.extend({
	computed: {
		pageCount(): number { return Math.ceil(this.resultCount / this.initialResults.summary.searchParam.number); },
		isCounting(): boolean { return this.error == null && this.results!.summary.stillCounting; },
		tooManyResults(): boolean { return (this.results!.summary as any).stoppedCountingHits; }, // if property missing, not too many results? TODO clarify these stopped/still variables with Jan and document in type.
		resultType(): string {
			if (BLTypes.isGroups(this.results)) {
				return 'groups';
			} else if (BLTypes.isHitResults(this.results)) {
				return 'hits';
			} else {
				return 'documents';
			}
		},
		resultCount(): number {
			if (BLTypes.isGroups(this.results)) {
				return this.results.summary.numberOfGroups;
			} else if (BLTypes.isHitResults(this.results)) {
				return this.results.summary.numberOfHits;
			} else {
				return this.results!.summary.numberOfDocs;
			}
		}
	},
	methods: {
		isDone(): boolean { return this.results == null || this.tooManyResults || !this.isCounting; },
		getNextRequestParams(): BLTypes.BlacklabParameters {
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
	// position: absolute;
    // top: 0px;
    // right: 25px;
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