<template>
	<div v-show="active" class="results-container">
		<span v-if="request" class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<Totals v-if="results"
			class="result-totals"
			:initialResults="results"
			:type="type"
			:indexId="indexId"

			@update="paginationResults = $event"
		/>

		<ol class="breadcrumb resultscrumb">
			<li v-for="(crumb, index) in breadCrumbs" :class="{'active': crumb.active}" :key="index">
				<a v-if="!crumb.active" href="#" @click.prevent="crumb.onClick" :title="crumb.title">{{crumb.label}}</a>
				<template v-else>{{crumb.label}}</template>
			</li>
		</ol>

		<GroupBy :type="type" :viewGroupName="viewGroupName"/>
		<!-- moved to totalscounter -->
		<!--
		<div v-if="results && !!(results.summary.stoppedRetrievingHits && !results.summary.stillCounting)" class="btn btn-sm btn-default nohover toomanyresults">
			<span class="fa fa-exclamation-triangle text-danger"></span> Too many results! &mdash; your query was limited
		</div> -->

		<div v-if="results" style="margin: 10px 0px;">
			<Pagination
				:page="pagination.shownPage"
				:maxPage="pagination.maxShownPage"

				@change="page = $event"
			/>
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
		</template>
		<template v-else-if="results"><div class="no-results-found">No results found.</div></template>
		<template v-else-if="error"><div class="no-results-found">{{error.message}}</div></template>

		<!-- Ugly - use v-show instead of v-if because teardown of selectpickers is problematic :( -->
		<div v-show="resultsHaveData" class="buttons" style="text-align: right;">
			<SelectPicker
				title="Sort by..."
				data-size="auto"
				data-show-subtext="true"
				data-style="btn-default btn-sm"
				data-window-padding="[150, 0, 50, 0]"
				data-hide-disabled="true"
				:data-live-search="sortOptions.flat(2).length > 20 ? 'true' : undefined"

				:options="sortOptions"
				:escapeLabels="false"

				v-model="sort"
			/>

			<button type="button" class="btn btn-primary btn-sm"  v-if="isDocs && resultsHaveHits"  @click="showDocumentHits = !showDocumentHits">{{showDocumentHits ? 'Hide Hits' : 'Show Hits'}}</button>
			<button type="button" class="btn btn-primary btn-sm"  v-if="isHits" @click="showTitles = !showTitles">{{showTitles ? 'Hide' : 'Show'}} Titles</button>
			<button type="button" class="btn btn-default btn-sm" v-if="results" :disabled="downloadInProgress || !resultsHaveData" @click="downloadCsv" :title="downloadInProgress ? 'Downloading...' : undefined"><template v-if="downloadInProgress">&nbsp;<span class="fa fa-spinner"></span></template>Export CSV</button>
		</div>

	</div>

</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';
import {saveAs} from 'file-saver';

import * as Api from '@/api';

import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';
import * as ResultsStore from '@/store/results';
import * as GlobalStore from '@/store/results/global';
import * as QueryStore from '@/store/query';
import * as InterfaceStore from '@/store/form/interface';

import {submittedSubcorpus$} from '@/store/streams';

import GroupResults from '@/pages/search/results/table/GroupResults.vue';
import HitResults from '@/pages/search/results/table/HitResults.vue';
import DocResults from '@/pages/search/results/table/DocResults.vue';
import Totals from '@/pages/search/results/ResultTotals.vue';
import GroupBy from '@/pages/search/results/groupby/GroupBy.vue';

import Pagination from '@/components/Pagination.vue';
import SelectPicker, {Option, OptGroup} from '@/components/SelectPicker.vue';

import {debugLog} from '@/utils/debug';

import * as BLTypes from '@/types/blacklabtypes';

export default Vue.extend({
	components: {
		Pagination,
		GroupResults,
		HitResults,
		DocResults,
		Totals,
		GroupBy,
		SelectPicker
	},
	props: {
		type: {
			type: String as () => ResultsStore.ViewId,
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

		paginationResults: null as null|BLTypes.BLSearchResult,

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
				debugLog('cancelling previous search request');
				this.cancel();
				this.request = null;
				this.cancel = null;
			}

			const params = RootStore.get.blacklabParameters()!;

			if (this.type === 'hits' && !params.patt) {
				this.results = null;
				this.paginationResults = null;
				this.error = new Api.ApiError('No results', 'No hits to display... (one or more of Lemma/PoS/Word is required).', 'No results');
				return;
			}

			const apiCall = this.type === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			debugLog('starting search', this.type, params);

			const r = apiCall(this.indexId, params, {
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
			this.paginationResults = data;
			this.error = null;
			this.request = null;
			this.cancel = null;
		},
		setError(data: Api.ApiError) {
			if (data.title !== 'Request cancelled') { // TODO
				debugLog('Request failed: ', data);
				this.error = data;
				this.results = null;
				this.paginationResults = null;
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
		storeModule() { return ResultsStore.get.resultsModules().find(m => m.namespace === this.type)!; },
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

		refreshParameters() {
			return {
				global: GlobalStore.getState(),
				self: this.storeModule.getState(),
				query: QueryStore.getState()
			}
		},

		// When these change, the form has been resubmitted, so we need to initiate a scroll event
		querySettings() { return QueryStore.getState(); },

		pagination(): {
			// totalResults: number,
			shownPage: number,
			maxShownPage: number
		} {
			const r: BLTypes.BLSearchResult|null = this.paginationResults || this.results;
			if (r == null) {
				return {
					shownPage: 0,
					maxShownPage: 0,
				}
			}

			const pageSize = this.results!.summary.requestedWindowSize;
			const shownPage = Math.floor(this.results!.summary.windowFirstResult / pageSize);
			const totalResults = BLTypes.isGroups(r) ? r.summary.numberOfGroups :
			                     BLTypes.isHitResults(r) ? r.summary.numberOfHitsRetrieved :
			                     r != null ? r.summary.numberOfDocsRetrieved :
			                     0;

			// subtract one page if number of results exactly divisible by page size
			// e.g. 20 results for a page size of 20 is still only one page instead of 2.
			const pageCount = Math.floor(totalResults / pageSize) - ((totalResults % pageSize === 0 && totalResults > 0) ? 1 : 0)

			return {
				shownPage,
				maxShownPage: pageCount
			};
		},

		active(): boolean {
			return InterfaceStore.get.viewedResults() === this.type;
		},

		// simple view variables
		indexId(): string { return CorpusStore.getState().id; },
		resultsHaveData(): boolean {
			if (BLTypes.isDocGroups(this.results)) { return this.results.docGroups.length > 0; }
			if (BLTypes.isHitGroups(this.results)) { return this.results.hitGroups.length > 0; }
			if (BLTypes.isHitResults(this.results)) { return this.results.hits.length > 0; }
			if (BLTypes.isDocResults(this.results)) { return this.results.docs.length > 0; }
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
		sortOptions(): Array<Option|OptGroup> {
			// NOTE: we need to always pass all available options, then hide invalids based on displayed results
			// if we don't do this, sorting will be cleared on initial page load
			// This happens because results aren't loaded yet, thus isHits/isDocs/isGroups all return false, and no options would be available
			// then the selectpicker will reset value to undefined, which clears it in the store, which updates the url, etc.
			const opts = [] as Array<Option|OptGroup>;

			opts.push({
				label: 'Groups',
				options: [{
					label: 'Sort by Identity',
					value: 'identity',
					// disabled: !this.isGroups
				}, {
					label: 'Sort by Size',
					value: 'size',
					// disabled: !this.isGroups
				}],
				disabled: !this.isGroups
			});

			const annotations = CorpusStore.get.annotations().filter(a => !a.isInternal && a.hasForwardIndex);

			[['wordleft:', 'Before hit', 'before'],['hit:', 'Hit', ''],['wordright:', 'After hit', 'after']]
			.forEach(([prefix, groupname, suffix]) =>
				opts.push({
					label: groupname,
					options: annotations.map(annot => ({
						label: `Sort by ${annot.displayName || annot.id} <small class="text-muted">${suffix}</small>`,
						value: `${prefix}${annot.id}`,
						// disabled: !this.isHits
					})),
					disabled: !this.isHits
				})
			);

			const metadataGroups = CorpusStore.get.metadataGroups();
			metadataGroups.forEach(group => opts.push({
				// https://github.com/INL/corpus-frontend/issues/197#issuecomment-441475896
				// (we don't show metadata groups in the Filters component unless there's more than one group, so don't show the group's name either in this case)
				label: metadataGroups.length > 1 ? group.name : 'Metadata',
				options: group.fields.map(field => ({
					label: `Sort by ${(field.displayName || field.id).replace(group.name, '')}`,
					value: `field:${field.id}`,
					// disabled: !this.isDocs
				})),
				disabled: !this.isDocs
			}));

			return opts;
		}
	},
	watch: {
		refreshParameters: {
			handler(cur, prev) {
				if (this.active) {
					this.refresh();
				} else {
					this.markDirty();
				}
			},
			deep: true
		},
		active: {
			handler(active) {
				if (active && this.isDirty) {
					this.refresh();
				}
			},
			immediate: true
		},

		querySettings: {
			deep: true,
			handler() {
				this.scroll = true;
			},
		},
	}
});
</script>

<style lang="scss">

// .toomanyresults {
// 	align-self: flex-start;
// 	border-radius: 100px;
// 	margin-right: 5px;
// 	margin-bottom: 5px;
// }

.buttons {
	flex: 0 1000 auto;
	font-size: 0;
	> button,
	> .bootstrap-select {
		margin-bottom: 5px;
		margin-left: 5px;
		vertical-align: top;

		&:first-child {
			margin-left: 0;
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
		bottom: -51px;
		pointer-events: none;
		// transform: translateY(100%);
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