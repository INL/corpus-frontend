<template>
	<div v-show="active" class="results-container">
		<span v-if="request" class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<Totals v-if="results"
			class="result-totals"
			:initialResults="results"
			:type="type"
			:indexId="indexId"
		/>

		<ol class="breadcrumb resultscrumb">
			<li v-for="(crumb, index) in breadCrumbs" :class="{'active': crumb.active}" :key="index">
				<a v-if="!crumb.active" href="#" @click.prevent="crumb.onClick" :title="crumb.title">{{crumb.label}}</a>
				<template v-else>{{crumb.label}}</template>
			</li>
		</ol>

		<GroupBy :type="type" :viewGroupName="viewGroupName"/>

		<div v-if="results && !!(results.summary.stoppedRetrievingHits && !results.summary.stillCounting)" class="btn btn-sm btn-default nohover toomanyresults">
			<span class="fa fa-exclamation-triangle text-danger"></span> Too many results! &mdash; your query was limited
		</div>

		<div v-if="results" style="margin: 10px 0px;">
			<Pagination :page="shownPage" :maxPage="maxShownPage" @change="page = $event"/>
		</div>

		<template v-if="resultsHaveData">
			<GroupResults v-if="isGroups"
				class="results-table"

				:results="results"
				:sort="sort"
				:type="type"

				@sort="sort = $event"
				@viewgroup="viewGroup = $event.id; _viewGroupName = $event.displayName"
			/>
			<HitResults v-else-if="isHits"
				class="results-table"

				:results="results"
				:sort="sort"
				:showTitles="showTitles"

				@sort="sort = $event"
			/>
			<DocResults v-else
				class="results-table"

				:results="results"
				:sort="sort"
				:showDocumentHits="showDocumentHits"

				@sort="sort = $event"
			/>

			<hr>

			<div class="buttons" style="text-align: right;">
				<button type="button" class="btn btn-danger btn-sm"  v-if="isDocs && resultsHaveHits"  @click="showDocumentHits = !showDocumentHits">{{showDocumentHits ? 'Hide Hits' : 'Show Hits'}}</button>
				<button type="button" class="btn btn-danger btn-sm"  v-if="isHits" @click="showTitles = !showTitles">{{showTitles ? 'Hide' : 'Show'}} Titles</button>
				<button type="button" class="btn btn-default btn-sm" v-if="results" :disabled="downloadInProgress || !resultsHaveData" @click="downloadCsv" :title="downloadInProgress ? 'Downloading...' : undefined"><template v-if="downloadInProgress">&nbsp;<span class="fa fa-spinner"></span></template>Export CSV</button>
			</div>

		</template>
		<template v-else-if="results"><div class="no-results-found">No results found.</div></template>
		<template v-else-if="error"><div class="no-results-found">{{error.message}}</div></template>

	</div>

</template>

<script lang="ts">
import Vue from "vue";
import URI from 'urijs';
import {saveAs} from 'file-saver';

import uid from '@/mixins/uid';

import * as resultsStore from '@/store/results';
import * as settingsStore from '@/store/settings';
import * as globalStore from '@/store';
import * as corpus from '@/store/corpus';
import * as query from '@/store/form';
import * as historyStore from '@/store/history';
import {submittedSubcorpus$} from '@/store/streams';

import * as Api from '@/api';

import GroupResults from '@/pages/search/results/table/GroupResults.vue';
import HitResults from '@/pages/search/results/table/HitResults.vue';
import DocResults from '@/pages/search/results/table/DocResults.vue';
import Totals from '@/pages/search/results/ResultTotals.vue';
import GroupBy from '@/pages/search/results/groupby/GroupBy.vue';
import Pagination from '@/components/Pagination.vue';

import {getUrlFromParameters, getBLSearchParametersFromState} from '@/utils';
import {debugLog} from '@/utils/debug';

import * as BLTypes from '@/types/blacklabtypes';

// TODO move to url management module, once vuexbridge is more factored out
/** Callback from when a search is executed (not neccesarily by the user, could also just be pagination and the like) */
function onSearchUpdated(operation: string, searchParams: BLTypes.BLSearchParameters) {
	// Only push new url if different
	// Why? Because when the user goes back say, 10 pages, we reinit the page and do a search with the restored parameters
	// this search would push a new history entry, popping the next 10 pages off the stack, which the url is the same because we just entered the page.
	// So don't do that.

	// If we generate very long page urls, tomcat cannot parse our requests (referrer header too long)
	// So omit the query from the page url in these cases
	// TODO this breaks history-based navigation
	let newUrl = getUrlFromParameters(operation, searchParams);
	const currentUrl = new URI().toString();

	if (newUrl !== currentUrl) {
		if (newUrl.length > 4000) {
			newUrl = getUrlFromParameters(operation, $.extend({}, searchParams, { patt: null }));
		}
		// No need to save a massive object that never changes with every history entry
		history.pushState(JSON.parse(JSON.stringify(Object.assign({}, globalStore.getState(), {corpus: undefined, history: undefined}))), undefined, newUrl);
	}
}

export default Vue.extend({
	mixins: [uid],
	components: {
		Pagination,
		GroupResults,
		HitResults,
		DocResults,
		Totals,
		GroupBy
	},
	props: {
		type: {
			type: String as () => resultsStore.ViewId,
			required: true,
		}
	},
	data: () => ({
		isDirty: true, // since we don't have any results yet
		request: null as null|Promise<BLTypes.BLSearchResult>,
		results: null as null|BLTypes.BLSearchResult,
		error: null as null|Api.ApiError,
		cancel: null as null|Api.Canceler,

		_viewGroupName: null as string|null,
		showTitles: true,
		showDocumentHits: false,
		downloadInProgress: false, // csv download

		// Should we scroll when next results arrive - set when main form submitted
		scroll: true,
	}),
	methods: {
		markDirty() {
			this.isDirty = true;
			if (this.cancel) {
				debugLog('cancelling search request');
				this.cancel();
				this.cancel = null;
				this.request = null;
			}
		},
		refresh() {
			this.isDirty = false;
			debugLog('this is when the search should be refreshed');

			if (this.cancel) {
				console.log('cancelling search request');
				this.cancel();
				this.request = null;
				this.cancel = null;
			}

			const state = globalStore.getState();
			const params = getBLSearchParametersFromState(state);
			historyStore.actions.addEntry(state);
			onSearchUpdated(this.type, params);

			if (this.type === 'hits' && !params.patt) {
				this.results = null;
				this.error = new Api.ApiError('No results', 'No hits to display... (one or more of Lemma/PoS/Word is required).', 'No results');
				return;
			}

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			debugLog('starting search', this.type, params);

			const r = apiCall(corpus.getState().id, params, {
				headers: { 'Cache-Control': 'no-cache' }
			});
			this.request = r.request;
			this.cancel = r.cancel;

			this.request
			.then(this.setSuccess, this.setError)
			.finally(() => {
				if (this.scroll) {
					this.scroll = false;
					window.scroll({
						behavior: 'smooth',
						top: this.$el.offsetTop - 150
					})
				}
			});
		},
		setSuccess(data: BLTypes.BLSearchResult) {
			debugLog('search results', data);
			this.results = data;
			this.error = null;
			this.request = null;
			this.cancel = null;
		},
		setError(data: Api.ApiError) {
			if (data.title !== 'Request cancelled') { // TODO
				debugLog('Request failed: ', data);
				this.error = data;
				this.results = null;
			}
			this.request = null;
			this.cancel= null;
		},
		downloadCsv() {
			if (this.downloadInProgress || !this.results) {
				return;
			}

			this.downloadInProgress = true;
			const params = this.results.summary.searchParam;
			const apiCall = this.type === 'hits' ? Api.blacklab.getHitsCsv : Api.blacklab.getDocsCsv;
			debugLog('starting csv download', this.type, params);

			apiCall(this.indexId, this.results.summary.searchParam).request
			.then(
				blob => saveAs(blob, 'data.csv'),
				error => debugLog('Error downloading csv file', error)
			)
			.finally(() => {
				this.downloadInProgress = false;
			});
		}
	},
	computed: {
		// Store properties
		storeModule() { return resultsStore.modules[this.type]; },
		groupBy: {
			get(): string[] { return this.storeModule.getState().groupBy; },
			set(v: string[]) { this.storeModule.actions.groupBy(v); }
		},
		groupByAdvanced: {
			get(): string[] { return this.storeModule.getState().groupByAdvanced; },
			set(v: string[]) { this.storeModule.actions.groupByAdvanced(v); }
		},
		page: {
			get(): number { return this.storeModule.getState().page; },
			set(v: number) { this.storeModule.actions.page(v); }
		},
		sort: {
			get(): string|null { return this.storeModule.getState().sort; },
			set(v: string|null) { this.storeModule.actions.sort(v); }
		},
		viewGroup: {
			get(): string|null { return this.storeModule.getState().viewGroup; },
			set(v: string|null) { this.storeModule.actions.viewGroup(v); }
		},

		watchSettings() {
			return {
				resultsSettings: this.storeModule.getState(),
				viewSettings: settingsStore.getState(),
				querySettings: query.get.lastSubmittedParameters()
			}
		},

		// just to know when we should initiate a scroll event
		querySettings() { return query.get.lastSubmittedParameters(); },

		totalResults(): number {
			if (this.results == null) {
				return 0;
			} else if (BLTypes.isGroups(this.results)) {
				return this.results.summary.numberOfGroups;
			} else if (BLTypes.isHitResults(this.results)) {
				return this.results.summary.numberOfHitsRetrieved;
			} else {
				return this.results.summary.numberOfDocsRetrieved;
			}
		},
		/** 0-based page the current results contain */
		shownPage(): number {
			if (this.results == null) {
				return 0;
			} else {
				// No need for -1 trickery, as this is the first result shown whereas totalResults
				// is the last result shown
				const pageSize = this.results.summary.requestedWindowSize;
				return Math.floor(this.results.summary.windowFirstResult / pageSize);
			}
		},
		/** 0-based maximum page available for the current result set */
		maxShownPage(): number {
			if (this.results == null) {
				return 0;
			} else {
				const pageSize = this.results.summary.requestedWindowSize;
				const exact = this.totalResults % pageSize === 0;
				const pageCount = Math.floor(this.totalResults / pageSize);
				return exact ? pageCount - 1 : pageCount;
			}
		},

		active(): boolean {
			return globalStore.get.viewedResults() === this.type;
		},


		// simple view variables
		indexId(): string { return corpus.getState().id; },
		resultsHaveData(): boolean {
			if (BLTypes.isDocGroups(this.results)) return this.results.docGroups.length > 0;
			if (BLTypes.isHitGroups(this.results)) return this.results.hitGroups.length > 0;
			if (BLTypes.isHitResults(this.results)) return this.results.hits.length > 0;
			if (BLTypes.isDocResults(this.results)) return this.results.docs.length > 0;
			return false;
		},
		isHits(): boolean { return BLTypes.isHitResults(this.results); },
		isDocs(): boolean { return BLTypes.isDocResults(this.results); },
		isGroups(): boolean { return BLTypes.isGroups(this.results); },
		resultsHaveHits(): boolean { return this.results != null && !!this.results.summary.searchParam.patt},
		viewGroupName(): string {
			if (this.viewGroup == null) { return ''; }
			return this._viewGroupName ? this._viewGroupName :
			       this.viewGroup.substring(this.viewGroup.indexOf(':')+1) || '[unknown]'
		},

		breadCrumbs(): any {
			const r = [];
			r.push({
				label: this.type === 'hits' ? 'Hits' : 'Documents',
				title: 'Go back to ungrouped results',
				active: (this.groupBy.length + this.groupByAdvanced.length) === 0,
				onClick: () => { this.groupBy = []; this.groupByAdvanced = []; }
			});
			if ((this.groupBy.length + this.groupByAdvanced.length) > 0) {
				r.push({
					label: 'Grouped by ' + this.groupBy.concat(this.groupByAdvanced).toString(),
					title: 'Go back to grouped results',
					active: this.viewGroup == null,
					onClick: () => this.viewGroup = null
				})
			}
			if (this.viewGroup != null) {
				r.push({
					label: 'Viewing group ' + this.viewGroupName,
					title: '',
					active: true,
					onClick: undefined
				})
			}
			return r;
		},
	},
	watch: {
		watchSettings: {
			handler(cur, prev) {
				this.markDirty();
			},
			deep: true
		},
		isDirty(cur, prev) {
			if (cur && this.active) {
				this.refresh();
			}
		},
		active: {
			handler(cur, prev) {
				if (cur) {
					if (this.isDirty) {
						this.refresh();
					} else {
						// TODO slightly silly, we need to update the page url and the active history entry
						// when this tab is opened.
						// Normally that's done in refresh()
						const state = globalStore.getState();
						const params = getBLSearchParametersFromState(state);
						historyStore.actions.addEntry(state);
						onSearchUpdated(this.type, params);
					}
				}
			},
			immediate: true
		},

		querySettings() {
			this.scroll = true;
		},
	}
});
</script>

<style lang="scss">

.toomanyresults {
	align-self: flex-start;
	border-radius: 100px;
	margin-right: 5px;
	margin-bottom: 5px;
}

.buttons {
	flex: 0 1000 auto;
	font-size: 0;
	> button {
		margin-bottom: 5px;
		margin-left: 5px;
	}
	> button:first-child {
		margin-left: 0px;
	}
}

.no-results-found {
	padding: 1.25em;
	text-align: center;
	font-style: italic;
	font-size: 16px;
	color: #777;
}

.breadcrumb.resultscrumb {
	background: white;
	border-bottom: 1px solid rgba(0,0,0,0.1);
	border-radius: 0;
	margin: 0 -15px 30px;
	padding: 12px 15px;
	&:hover {
		// Pop in front of totals counter
		z-index: 3;
		position: relative;
	}

	&:after {
		background: linear-gradient(to bottom, white 25%, rgba(255,255,255,0));
		bottom: 0;
		content: "";
		transition-timing-function: ease-in-out;
		height: 50px;
		left: 0;
		position: absolute;
		right: 0;
		transform: translateY(100%);
		transition: opacity 0.17s;
		z-index: 100;

		display: none;
	}
	&:hover:after,
	&:focus:after,
	&:focus-within:after {
		display: block;
	}
}

table {
	> thead > tr > th {
		text-align: left;
		background-color: white;
		border-bottom: 1px solid #aaa;
		padding-bottom: 5px;
	}

	> tbody > tr > td {
		vertical-align: top;
	}
}

a.clear,
a.sort {
	cursor: pointer;
}

.result-totals {
	position: absolute;
	right: -15px;
	top: 0;
	background: white;
	padding: 8px 8px 15px 15px;
	z-index: 2;

	&:before {
		content: "";
		display: block;
		position: absolute;
		height: 100%;
		width: 50px;
		left: -50px;
		top: 0;
		background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,255) 100%);
	}
}

.results-container {
	position: relative;
}

</style>