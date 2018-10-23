<template>
	<div v-show="active">
		<span v-if="request" class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<Totals v-if="results"
			:initialResults="results"
			:type="type"
			:indexId="indexId"
		/>

		<div v-show="results || error" class="resultcontrols">
			<div class="top">
				<div class="grouping">
					<div class="groupselect-container">

						<SelectPicker v-model="groupBy"
							multiple
							class="groupselect"
							data-size="15"
							data-actions-box="true"
							data-deselect-all-text="reset"
							data-show-subtext="true"
							data-style="btn-default btn-sm"

							:options="optGroups"
							:escapeLabels="false"

							:title="`Group ${type} by...`"
						/>

						<button type="button" class="btn btn-sm btn-default dummybutton">update</button> <!-- dummy button... https://github.com/INL/corpus-frontend/issues/88 -->
						<div v-if="groupBy && groupBy.length > 0 && !viewGroup" class="checkbox-inline" style="margin-left: 5px;">
							<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0;" :for="uid+'case'"><input type="checkbox" :id="uid+'case'" v-model="caseSensitive">Case sensitive</label>
						</div>
					</div>

					<div v-if="viewGroup" class="btn btn-sm btn-default nohover viewgroup" >
						<span class="fa fa-exclamation-triangle text-danger"></span> Viewing group <span class="name">{{viewGroupName || viewGroup}}</span> &mdash; <a class="clear" @click="viewGroup = null">Go back</a>
					</div>

					<div v-if="results && !!(results.summary.stoppedRetrievingHits && !results.summary.stillCounting)" class="btn btn-sm btn-default nohover toomanyresults">
						<span class="fa fa-exclamation-triangle text-danger"></span> Too many results! &mdash; your query was limited
					</div>
				</div>

				<div class="buttons">
					<button type="button" class="btn btn-danger btn-sm"  v-if="isDocs && resultsHaveHits"  @click="showDocumentHits = !showDocumentHits">{{showDocumentHits ? 'Hide Hits' : 'Show Hits'}}</button>
					<button type="button" class="btn btn-danger btn-sm"  v-if="isHits" @click="showTitles = !showTitles">{{showTitles ? 'Hide' : 'Show'}} Titles</button>
					<button type="button" class="btn btn-default btn-sm" v-if="results" :disabled="downloadInProgress || !resultsHaveData" @click="downloadCsv" :title="downloadInProgress ? 'Downloading...' : undefined"><template v-if="downloadInProgress">&nbsp;<span class="fa fa-spinner"></span></template>Export CSV</button>
				</div>
			</div>

			<Pagination v-if="results" :page="shownPage" :maxPage="maxShownPage" @change="page = $event"/>
		</div>

		<div v-if="resultsHaveData" class="lightbg haspadding resultcontainer">
			<GroupResults v-if="isGroups"
				:results="results"
				:sort="sort"
				:type="type"

				@sort="sort = $event"
				@viewgroup="viewGroup = $event.id; viewGroupName = $event.displayName"
			/>
			<HitResults v-else-if="isHits"
				:results="results"
				:sort="sort"
				:showTitles="showTitles"

				@sort="sort = $event"
			/>
			<DocResults v-else
				:results="results"
				:sort="sort"
				:showDocumentHits="showDocumentHits"

				@sort="sort = $event"
			/>
		</div>
		<div v-else class="lightbg haspadding resultcontainer">
			<template v-if="results"><div class="no-results-found">No results found.</div></template>
			<template v-else-if="error"><div class="no-results-found">{{error.message}}</div></template>
		</div>

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

import * as bls from "@/modules/singlepage-bls";
import * as BLTypes from '@/types/blacklabtypes';
import * as Api from '@/api';

import SelectPicker, {OptGroup} from '@/components/SelectPicker.vue';
import Pagination from '@/components/Pagination.vue';

import GroupResults from '@/pages/search/GroupResults.vue';
import HitResults from '@/pages/search/HitResults.vue';
import DocResults from '@/pages/search/DocResults.vue';
import Totals from '@/components/ResultTotals.vue';

import {toPageUrl} from '@/utils';
import {debugLog} from '@/utils/debug';

// TODO verify we don't store non-serializable elements in the store
// TODO move to url management module, once vuexbridge is more factored out
/** Callback from when a search is executed (not neccesarily by the user, could also just be pagination and the like) */
function onSearchUpdated(operation: string, searchParams: BLTypes.BlacklabParameters) {
	// Only push new url if different
	// Why? Because when the user goes back say, 10 pages, we reinit the page and do a search with the restored parameters
	// this search would push a new history entry, popping the next 10 pages off the stack, which the url is the same because we just entered the page.
	// So don't do that.

	// If we generate very long page urls, tomcat cannot parse our requests (referrer header too long)
	// So omit the query from the page url in these cases
	// TODO this breaks history-based navigation
	let newUrl = toPageUrl(operation, searchParams);
	if (newUrl.length > 4000) {
		newUrl = toPageUrl(operation, $.extend({}, searchParams, { patt: null }));
	}

	const currentUrl = new URI().toString();
	if (newUrl !== currentUrl) {
		history.pushState(JSON.parse(JSON.stringify(globalStore.getState())), undefined, newUrl);
	}
}

export default Vue.extend({
	mixins: [uid],
	components: {
		SelectPicker,
		Pagination,
		GroupResults,
		HitResults,
		DocResults,
		Totals
	},
	props: {
		type: {
			type: String as () => 'hits'|'docs',
			required: true,
		}
	},
	data: () => ({
		isDirty: true, // since we don't have any results yet
		request: null as null|Promise<BLTypes.BLSearchResult>,
		results: null as null|BLTypes.BLSearchResult,
		error: null as null|Api.ApiError,
		cancel: null as null|Api.Canceler,

		viewGroupName: null as string|null,
		showTitles: true,
		showDocumentHits: false,
		downloadInProgress: false, // csv download
	}),
	methods: {
		markDirty() {
			this.isDirty = true;
			if (this.cancel) {
				console.log('cancelling search request');
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

			const params = bls.getBlsParamFromState();
			if (this.type === 'hits' && !params.patt) {
				this.error = new Api.ApiError('No results', 'No hits to display... (one or more of Lemma/PoS/Word is required).', 'No results');
				return;
			}

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			debugLog('starting search', this.type, params);

			const r = apiCall(corpus.getState().id, params);
			this.request = r.request;
			this.cancel = r.cancel;

			this.request.then(this.setSuccess, this.setError);
			onSearchUpdated(this.type, params);
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
		caseSensitive: {
			get(): boolean { return this.storeModule.getState().caseSensitive },
			set(v: boolean) { this.storeModule.actions.caseSensitive(v); }
		},
		groupBy: {
			get(): string[] { return this.storeModule.getState().groupBy; },
			set(v: string[]) { this.storeModule.actions.groupBy(v); }
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

		// Calculated fields
		optGroups(): OptGroup[] {
			const groups: OptGroup[] = [];

			const metadataGroups = corpus.get.metadataGroups();
			if (this.type === 'hits') {
				const annotations = corpus.get.annotations();

				[['wordleft:', 'Before hit', 'before'],['hit:', 'Hit', ''],['wordright:', 'After hit', 'after']]
				.forEach(([prefix, groupname, suffix]) =>
					groups.push({
						label: groupname,
						options: annotations.map(annot => ({
							label: `Group by ${annot.displayName} <small class="text-muted">${suffix}</small>`,
							value: `${prefix}${annot.id}`
						}))
					})
				);
			}
			metadataGroups.forEach(group => groups.push({
				label: group.name,
				options: group.fields.map(field => ({
					label: (field.displayName || field.id).replace(group.name, ''),
					value: `field:${field.id}`
				}))
			}))
			return groups;
		},


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
				const pageSize = this.results.summary.requestedWindowSize;
				return Math.floor(this.results.summary.windowFirstResult / pageSize);
			}
		},
		/** 0-based maximum page available for the current result set */
		maxShownPage(): number {
			if (this.results == null) {
				return 0;
			} else {
				return Math.floor(this.totalResults / this.results.summary.requestedWindowSize);
			}
		},

		active() {
			return globalStore.get.viewedResults() === this.type;
		},


		// simple view variables
		indexId() { return corpus.getState().id; },
		resultsHaveData() {
			if (BLTypes.isDocGroups(this.results)) return this.results.docGroups.length > 0;
			if (BLTypes.isHitGroups(this.results)) return this.results.hitGroups.length > 0;
			if (BLTypes.isHitResults(this.results)) return this.results.hits.length > 0;
			if (BLTypes.isDocResults(this.results)) return this.results.docs.length > 0;
			return false;
		},
		isHits() { return BLTypes.isHitResults(this.results); },
		isDocs() { return BLTypes.isDocResults(this.results); },
		isGroups() { return BLTypes.isGroups(this.results); },
		resultsHaveHits() { return this.results != null && this.results.summary.searchParam.patt}
	},
	watch: {
		watchSettings: {
			handler(cur, prev) {
				this.markDirty();
				if (cur.querySettings !== prev.querySettings && cur.querySettings !== null) {
					// TODO move to some other place
					$('html, body').animate({
						scrollTop: $('.querysummary').offset()!.top - 75 // navbar
					}, 500);
				}
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
				if (cur && this.isDirty) {
					this.refresh();
				}
			},
			immediate: true
		}
	}
});
</script>

<style lang="scss">

.resultcontrols {
	>.top {
		align-items: flex-start;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;

		>.grouping {
			display: flex;
			flex-wrap: wrap;
			min-width: 220px;
			margin-right: 5px;
			max-width: 100%;

			>.groupselect-container {
				align-items: center;
				align-self: flex-start;
				display: flex;
				flex-wrap: nowrap;
				margin-bottom: 5px;
				margin-right: 5px;

				> .groupselect {
					flex: 1 1 auto;
					min-width: 0px!important;
					width: auto!important;

					> button {
						border-top-right-radius: 0px;
						border-bottom-right-radius: 0px;
						border-right: 0px;
					}
				}
				>.dummybutton {
					flex: none;
					border-top-left-radius: 0px;
					border-bottom-left-radius: 0px;
				}

				// li a {
				// 	text-transform: capitalize;
				// }
			}
			> .viewgroup {
				align-self: flex-start;
				border-radius: 100px;
				margin-right: 5px;
				margin-bottom: 5px;
				>.name {
					font-style: italic;
					display: inline-block;
					overflow-x: hidden;
					margin-bottom: -5px;
					max-width: 150px;
					text-overflow: ellipsis;
					padding-right: 1px; /* :after quote gets cut off sometimes due to overflow-hidden */

					:before,
					:after {
						content: "'";
					}
				}
				>.clear {
					font-weight: 700;
					text-decoration: underline!important;
					padding-left: 2px;
				}
			}
			> .toomanyresults {
				align-self: flex-start;
				border-radius: 100px;
				margin-right: 5px;
				margin-bottom: 5px;
			}
		}

		>.buttons {
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
	}
}

.no-results-found {
	padding: 1.25em;
	text-align: center;
	font-style: italic;
	font-size: 16px;
	color: #777;
}

.resultcontainer {
	margin-top: 5px;
}

.table {
	table-layout: fixed;
	width: 100%;
}

td {
	vertical-align: top;
}

th {
	text-align: left;
	background-color: #ffffff;
	border-bottom: 1px solid #aaaaaa;
}

.well-light {
	background: rgba(255,255,255,0.8);
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	box-shadow: inset 0 1px 2px 0px rgba(0,0,0,0.1);
	margin-bottom: 8px;
	padding: 8px
}

a.clear,
a.sort {
	cursor: pointer;
}

</style>