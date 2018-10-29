
<script lang="ts">
import Vue from  'vue';

import * as Api from '@/api';

import * as BLTypes from '@/types/blacklabtypes';

const default_delay = 1000;

export default Vue.extend({
	props: {
		initialParams: {
			type: Object as () => BLTypes.BlacklabParameters,
			required: false,
		},
		initialResults: {
			type: Object as () => BLTypes.BLSearchResult,
			required: false
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
	watch: {
		initialParams: {
			immediate: true,
			handler(newValue: null|BLTypes.BlacklabParameters) {
				this.stop();
				this.results = null;
				if (!this.isDone()) {
					this.start();
				}
			}
		},
		initialResults: {
			immediate: true,
			handler(newValue: null|BLTypes.BLSearchResult) {
				this.stop();
				this.results = newValue;
				if (!this.isDone()) {
					this.start();
				}
			}
		}
	},
	data: () => ({
		request: null as null|Promise<BLTypes.BLSearchResult>,
		nextRequest: null as null|number,
		cancel: null as null|Api.Canceler,

		results: null as null|BLTypes.BLSearchResult,
		error: null as null|Api.ApiError
	}),
	methods: {
		/** Whether to start a new request based on the current results and parameters */
		isDone(): boolean { return !(this.results || this.initialParams); },
		getNextRequestParams(): BLTypes.BlacklabParameters { return this.initialParams || this.initialResults.summary.searchParam; },
		/** Get delay in ms until next request is started */
		getDelay(): number { return default_delay; },

		// Above methods should probably be overridden

		start() {
			// TODO is broken in some subtle way when cancelling and restarting often
			// use rxjs.
			const self = this; // TODO there is something weird going on with context here
			if (self.isDone()) {
				return;
			}

			if (self.cancel == null && self.nextRequest == null) {
				const apiCall = (self.type === 'docs') ? Api.blacklab.getDocs : Api.blacklab.getHits;
				const {request, cancel} = apiCall(self.indexId, self.getNextRequestParams());

				self.error = null;
				self.cancel = cancel;

				(request as Promise<BLTypes.BLSearchResult>)
				.then(r => {
					self.results = r;
					// Do not clear in .finally(), we write to nextRequest here
					self.cancel = null;
					self.nextRequest = null;
					if (!self.isDone()) {
						self.nextRequest = setTimeout(() => {
							self.nextRequest = null;
							self.start();
						}, self.getDelay());
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
				console.log('trying to start results retrieval but already busy??')
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