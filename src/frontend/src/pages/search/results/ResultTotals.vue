<template>
<div class="totals">
	<div class="totals-text" :title="percentOfSearchSpaceClarification">
		<span style="display: inline-block; vertical-align:top; ">
			Total {{resultType}}:<br>
			<template v-if="isGroups">Total groups:<br></template>
			Total pages:
		</span>
		<span style="display: inline-block; verical-align: top; text-align: right; font-family: monospace;">
			 <template v-if="isLimited">&ge;</template>{{numResults.toLocaleString()}}<template v-if="isCounting">&hellip;</template><br>
			<template v-if="isGroups">
			 <template v-if="isLimited">&ge;</template>{{numGroups.toLocaleString()}}<template v-if="isCounting">&hellip;</template><br>
			</template>
			 <template v-if="isLimited">&ge;</template>{{numPages.toLocaleString()}}<template v-if="isCounting">&hellip;</template>
		</span>
		<span style="display: inline-block; vertical-align:top; text-align: right; font-family: monospace;">
			<template v-if="searchSpaceCount !== -1 /* see corpus store documentCount property */">
			 ({{this.numResults / this.searchSpaceCount | frac2Percent}})
			</template>
		</span>
	</div>
	<span v-show="(isCounting || subcorpus == null) && !error" class="fa fa-spinner fa-spin searchIndicator totals-spinner"/>

	<div v-if="error" class="text-danger totals-warning" style="cursor: pointer;" @click="continueCounting" :title="`${error.message} - (click to retry).`">
		<span class="fa fa-exclamation-triangle text-danger"/> Network error!
	</div>
	<div v-else-if="isLimited" class="text-danger totals-warning" title="Stopped counting results because there are too many.">
		<span class="fa fa-exclamation-triangle text-danger"/> Too many results to count.
	</div>
	<div v-else-if="isPaused" class="text-info totals-warning" style="cursor: pointer;" title="Click to continue." @click="continueCounting">
		<span class="fa fa-redo text-info"></span> Counting paused.
	</div>
</div>
</template>


<script lang="ts">
import Vue from 'vue';

import {Subscription, ReplaySubject} from 'rxjs';

import * as Api from '@/api';

import { submittedSubcorpus$ as subcorpus$ } from '@/store/streams';
import yieldResultCounts, { CounterInput, CounterOutput } from '@/pages/search/results/TotalsCounterStream';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

import frac2Percent from '@/mixins/fractionalToPercent';

export default Vue.extend({
	filters: { frac2Percent },
	props: {
		initialResults: {
			required: true,
			type: Object as () => BLTypes.BLSearchResult
		},
		type: {
			required: true,
			type: String as () => 'hits'|'docs',
		},
		indexId: {
			required: true,
			type: String as () => string,
		}
	},
	data: () => ({
		subscriptions: [] as Subscription[],

		subcorpus: null as null|BLTypes.BLDocResults, // total searchSpace
		resultCount: {} as CounterOutput, // stream instantly returns output from the initials
		error: null as null|Api.ApiError,

		resultCount$: new ReplaySubject<CounterInput>(1),
	}),

	computed: {
		stats(): BLTypes.BLSearchResult { return this.resultCount.results; },
		isCounting(): boolean { return !this.error && this.resultCount.state === 'counting'; },
		isLimited(): boolean { return !this.error && this.resultCount.state === 'limited'; },
		isPaused(): boolean { return !this.error && this.resultCount.state === 'paused'; },

		resultType(): string { return BLTypes.isHitGroupsOrResults(this.stats) ? 'hits' : 'documents'; },
		isGroups(): boolean { return BLTypes.isGroups(this.stats); },

		numResults(): number { return BLTypes.isHitGroupsOrResults(this.stats) ? this.stats.summary.numberOfHits : this.stats.summary.numberOfDocs; },
		numResultsRetrieved(): number { return BLTypes.isHitGroupsOrResults(this.stats) ? this.stats.summary.numberOfHitsRetrieved : this.stats.summary.numberOfDocsRetrieved; },
		numGroups(): number { return BLTypes.isGroups(this.stats) ? this.stats.summary.numberOfGroups : 0; },
		numPages(): number { return Math.ceil((this.isGroups ? this.numGroups : this.numResultsRetrieved) / this.initialResults.summary.searchParam.number); },

		searchSpaceType(): string { return BLTypes.isHitGroupsOrResults(this.stats) ? 'tokens' : 'documents'; },
		/** The total number of relevant items in the searched subcorpus, tokens if viewing tokens, docs if viewing documents */
		searchSpaceCount(): number {
			if (this.subcorpus == null) {
				return -1;
			}

			return BLTypes.isHitGroupsOrResults(this.stats) ? this.subcorpus.summary.tokensInMatchingDocuments! : this.subcorpus.summary.numberOfDocs;
		},
		percentOfSearchSpaceClarification(): string {
			if (this.subcorpus == null) {
				return '';
			}

			return `Matched ${this.numResults.toLocaleString()} ${this.resultType} in a total of ${this.searchSpaceCount.toLocaleString()} ${this.searchSpaceType} in the searched subcorpus.`;
		}
	},
	methods: {
		continueCounting() {
			this.error = null;
			this.resultCount$.next({
				indexId: this.indexId,
				operation: this.type,
				results: this.stats
			});
		}
	},
	watch: {
		initialResults: {
			immediate: true,
			handler(v: BLTypes.BLSearchResult) {
				this.error = null;
				this.resultCount$.next({
					indexId: this.indexId,
					operation: this.type,
					results: v
				});
			}
		}
	},
	created() {
		this.subscriptions.push(
			this.resultCount$.pipe(yieldResultCounts).subscribe(
				v => this.resultCount = v,
				e => this.error = e
			),
			subcorpus$.subscribe(
				v => this.subcorpus = v,
				e => this.error = e
			)
		)
	},
	destroyed() {
		this.subscriptions.forEach(s => s.unsubscribe());
		this.resultCount$.complete();
	}
});
</script>

<style lang="scss">

.totals {
	color: #888;
	font-size: 85%;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
}

.totals-text {
	order: 2;
	white-space: nowrap;
}

.totals-warning {
	display: inline-flex;
	flex-wrap: nowrap;
	white-space: nowrap;
	align-items: center;
	border-style: solid;
	border-width: 1px;
	border-radius: 100px;
	padding: 2px 4px;
	margin-right: 10px;
	> .fa {
		font-size: 14px;
		margin-right: 3px;
	}
}

.searchIndicator.totals-spinner {
	order: 1;
	font-size: 16px;
	padding: 4px;
	margin: 0px 10px;
}

</style>