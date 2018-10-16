<script lang="ts">
import {Vue, Component, Watch, Prop} from 'vue-property-decorator';

import * as resultsStore from '@/store/results';
import * as rootStore from '@/store';
import * as formStore from '@/store/form';

import * as Api from '@/api';
import { getBlsParamFromState, search } from '@/modules/singlepage-bls';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

declare const BLS_URL: string;

// TODO for some reason the getters in this component aren't reactive...
// @Component({})
// export default class TotalsCounter extends Vue {
// 	private readonly refreshRate = 1_000;
// 	private readonly pauseAfterResults = 1_000_000; // TODO increment for next pause, reset on changing parameters
// 	private readonly indexId = BLS_URL.substring(BLS_URL.lastIndexOf('/', BLS_URL.length-2)+1, BLS_URL.length-1); //hmm...

// 	private cancel = null as Api.Canceler|null;
// 	private nextRequest = null as number|null;

// 	private results: BLTypes.BLSearchResult;
// 	private error = null as AppTypes.ApiError|null;

// 	@Prop({required: true}) initialResults: BLTypes.BLSearchResult;
// 	@Prop({required: true}) type: 'hits'|'docs';

// 	@Watch('initialResults', {immediate: true, deep: true})
// 	onInitialResultsChange(newValue: TotalsCounter['initialResults']) {

// 		debugger;
// 		this.stop();
// 		this.results = newValue;
// 		// TODO verify not to many results already
// 		if (!this.tooManyResults && this.isCounting) {
// 			this.start();
// 		}
// 	}

// 	beforeDestroy() {
// 		stop();
// 	}

// 	/** Continue if stopped */
// 	start() {
// 		if (this.cancel == null && this.nextRequest == null) {
// 			let c;
// 			if (this.type === 'docs') {
// 				c = Api.blacklab.getDocs(this.indexId, {
// 					...this.results.summary.searchParam,
// 					number: 0
// 				})
// 			} else {
// 				c = Api.blacklab.getHits(this.indexId, {
// 					...this.results.summary.searchParam,
// 					number: 0
// 				})
// 			}

// 			const {request, cancel} = c;
// 			this.cancel = cancel;

// 			(request as Promise<BLTypes.BLSearchResult>)
// 			.then(r => {
// 				this.results = r;
// 				// Do not clear in .finally(), we write to nextRequest here
// 				this.cancel = null;
// 				this.nextRequest = null;
// 				if (this.resultCount < this.pauseAfterResults && !this.tooManyResults) {
// 					this.nextRequest = setTimeout(() => this.start(), this.refreshRate);
// 				}
// 			}).catch(e => {
// 				if (e.name !== 'AbortError') {
// 					this.error = e
// 				}
// 				// Do not clear in .finally(), we write to nextRequest in .then
// 				this.cancel = null;
// 				this.nextRequest = null;
// 			});
// 		}
// 	}

// 	stop() {
// 		if (this.cancel != null) {
// 			this.cancel();
// 			this.cancel = null;
// 		}
// 		if (this.nextRequest != null) {
// 			clearTimeout(this.nextRequest);
// 			this.nextRequest = null;
// 		}
// 	}

// 	get pageCount() { return Math.ceil(this.resultCount / this.initialResults.summary.searchParam.number); }
// 	get isCounting() { return this.results.summary.stillCounting; }
// 	get tooManyResults() { return this.results.summary.stoppedCountingHits; }
// 	get resultType() {
// 		if (BLTypes.isGroups(this.results)) {
// 			return 'groups';
// 		} else if (BLTypes.isHitResults(this.results)) {
// 			return 'hits';
// 		} else {
// 			return 'documents';
// 		}
// 	}
// 	get resultCount() {
// 		if (BLTypes.isGroups(this.results)) {
// 			return this.results.summary.numberOfGroups;
// 		} else if (BLTypes.isHitResults(this.results)) {
// 			return this.results.summary.numberOfHits;
// 		} else {
// 			return this.results.summary.numberOfDocs;
// 		}
// 	}
// }

const refreshRate = 1_000;
const pauseAfterResults = 1_000_000; // TODO increment for next pause, reset on changing parameters
const indexId = BLS_URL.substring(BLS_URL.lastIndexOf('/', BLS_URL.length-2)+1, BLS_URL.length-1); //hmm...

export default Vue.extend({
	props: {
		initialResults: {
			type: Object as () => BLTypes.BLSearchResult,
			required: true
		},
		type: {
			type: String as () => 'hits'|'docs',
			required: true
		}
	},
	data: () => ({
		cancel: null as Api.Canceler|null,
		nextRequest: null as number|null,

		results: null as any as BLTypes.BLSearchResult,
		error: null as AppTypes.ApiError|null,
	}),
	watch: {
		initialResults: {
			immediate: true,
			handler(newValue: BLTypes.BLSearchResult) {
				this.stop();
				this.results = newValue;
				if (!this.tooManyResults && this.isCounting) {
					this.start();
				}
			}
		}
	},
	computed: {
		pageCount(): number { return Math.ceil(this.resultCount / this.initialResults.summary.searchParam.number); },
		isCounting(): boolean { return this.results.summary.stillCounting; },
		tooManyResults(): boolean { return this.results.summary.stoppedCountingHits; },
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
				return this.results.summary.numberOfDocs;
			}
		}
	},
	methods: {
		start() {
			if (this.cancel == null && this.nextRequest == null) {
				const apiCall = (this.type === 'docs') ? Api.blacklab.getDocs : Api.blacklab.getHits;
				const {request, cancel} = apiCall(indexId, {
					...this.results.summary.searchParam,
					number: 0
				});
				this.cancel = cancel;

				(request as Promise<BLTypes.BLSearchResult>)
				.then(r => {
					this.results = r;
					// Do not clear in .finally(), we write to nextRequest here
					this.cancel = null;
					this.nextRequest = null;
					if (this.resultCount < pauseAfterResults && !this.tooManyResults) {
						this.nextRequest = setTimeout(() => this.start(), refreshRate);
					}
				}).catch(e => {
					if (e.name !== 'AbortError') {
						this.error = e
					}
					// Do not clear in .finally(), we write to nextRequest in .then
					this.cancel = null;
					this.nextRequest = null;
				});
			}
		},

		stop() {
			if (this.cancel != null) {
				this.cancel();
				this.cancel = null;
			}
			if (this.nextRequest != null) {
				clearTimeout(this.nextRequest);
				this.nextRequest = null;
			}
		}
	},

	beforeDestroy() {
		this.stop();
	}
});
</script>

<template>
<div class="totals">
	<div class="totals-text">
 			Total {{resultType}}: {{resultCount}}<template v-if="isCounting">&hellip;</template><br>
 			Total pages: {{pageCount}}<template v-if="isCounting">&hellip;</template>
	</div>
	<span v-show="isCounting" class="fa fa-spinner fa-spin searchIndicator totals-spinner"/>
	<div v-if="tooManyResults" class="text-danger text-center totals-warning" style="margin: 0px 10px;">
		<span class="fa fa-exclamation-triangle text-danger" style="font-size: 20px;"/><br>
		Too many results!
	</div>
</div>
</template>

<style lang="scss">

.totals {
	color: #888;
	font-size: 85%;
	position: absolute;
    top: 20px;
    right: 25px;
    display: flex;
    align-items: center;
}

#totals-text {
	order: 2;
}

.totals-spinner {
	order: 1;
	font-size: 16px;
	padding: 4px;
	margin: 0px 10px;
}

</style>