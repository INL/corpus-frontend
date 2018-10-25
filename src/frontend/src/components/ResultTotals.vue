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
import {Vue, Component, Watch, Prop} from 'vue-property-decorator';

import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';
import * as AppTypes from '@/types/apptypes';

const refreshRate = 1_000;
const pauseAfterResults = 1_000_000; // TODO time-based pausing, see https://github.com/INL/corpus-frontend/issues/164

export default Vue.extend({
	props: {
		initialResults: {
			type: Object as () => BLTypes.BLSearchResult,
			required: true
		},
		type: {
			type: String as () => 'hits'|'docs',
			required: true
		},
		indexId: {
			type: String as () => string,
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
		isCounting(): boolean { return this.error == null && this.results.summary.stillCounting; },
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
			const self = this; // TODO there is something weird going on with context here

			if (self.cancel == null && self.nextRequest == null) {
				const apiCall = (self.type === 'docs') ? Api.blacklab.getDocs : Api.blacklab.getHits;
				const {request, cancel} = apiCall(self.indexId, {
					...self.results.summary.searchParam,
					number: 0
				});

				self.error = null;
				self.cancel = cancel;

				(request as Promise<BLTypes.BLSearchResult>)
				.then(r => {
					self.results = r;
					// Do not clear in .finally(), we write to nextRequest here
					self.cancel = null;
					self.nextRequest = null;
					if (self.resultCount < pauseAfterResults && !self.tooManyResults && self.isCounting) {
						self.nextRequest = setTimeout(() => {
							self.nextRequest = null;
							self.start();
						}, refreshRate);
					}
				}).catch(e => {
					if (e.name !== 'AbortError') {
						self.error = e
					}
					// Do not clear in .finally(), we write to nextRequest in .then
					self.cancel = null;
					self.nextRequest = null;
				});
			} else {
				debugger;
				console.log('trying to start totals retrieval but already busy??')
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

.totals-spinner {
	order: 1;
	font-size: 16px;
	padding: 4px;
	margin: 0px 10px;
}

</style>