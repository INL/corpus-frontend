<template>
	<div class="results-container" :disabled="request">
		<span v-if="request" class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<component v-if="resultsHaveData"
			:is="resultComponentName"
			v-bind="resultComponentData"

			@sort="sort = $event"
			@viewgroup="originalGroupBySettings = {page, sort}; viewGroup = $event.id; _viewGroupName = $event.displayName;"
		>

			<BreadCrumbs slot="breadcrumbs"
				:crumbs="breadCrumbs"
				:disabled="!!request"
			/>

			<Totals slot="totals"
				class="result-totals"
				:initialResults="results"
				:type="id"
				:indexId="indexId"

				@update="paginationResults = $event"
			/>

			<template #groupBy>

				<SelectPicker :options="['GroupBy1', 'GroupBy3']" v-model="selectedGroupBy" />

				<component :is="selectedGroupBy"
					:type="id"
					:results="results"
					:disabled="!!request"
					:originalGroupBySettings="originalGroupBySettings"
					@viewgroupLeave="leaveViewgroup"
				/>
			</template>

			<Pagination slot="pagination"
				style="display: block; margin: 10px 0;"

				:page="pagination.shownPage"
				:maxPage="pagination.maxShownPage"
				:disabled="!!request"

				@change="page = $event"
			/>


			<Sort slot="sort"
				v-model="sort"
				:hits="isHits"
				:docs="isDocs"
				:groups="isGroups"

				:corpus="corpus"
				:annotations="sortAnnotations"
				:metadata="sortMetadata"

				:disabled="!!request"
			/>

			<Export slot="export" v-if="exportEnabled"
				:results="results"
				:type="id"
				:disabled="!!request"
				:annotations="exportAnnotations"
				:metadata="exportMetadata"
			/>

		</component>
		<div v-else-if="results" class="no-results-found">No results found.</div>
		<div v-else-if="!valid" class="no-results-found">
			This view is inactive because no search criteria for words were specified.
		</div>
		<div v-else-if="error != null" class="no-results-found">
			<span class="fa fa-exclamation-triangle text-danger"></span><br>
			<span v-html="error"></span>
			<br>
			<br>
			<button type="button" class="btn btn-default" title="Try again with current search settings" @click="markDirty();">Try again</button>
		</div>



		<Debug>
			<div v-if="results">
				<hr>
				<div>BlackLab response: </div>
				<pre>{{JSON.stringify(results.summary, undefined, 2)}}</pre>
			</div>
		</Debug>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import jsonStableStringify from 'json-stable-stringify';

import * as Api from '@/api';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results/views';
import * as GlobalStore from '@/store/search/results/global';
import * as QueryStore from '@/store/search/query';
import * as UIStore from '@/store/search/ui';
import * as GlossModule from '@/store/search/form/glossStore' // Jesse

import GroupResults from '@/pages/search/results/table/GroupResults.vue';
import HitResults from '@/pages/search/results/table/HitResults.vue';
import DocResults from '@/pages/search/results/table/DocResults.vue';
import Totals from '@/pages/search/results/ResultTotals.vue';
import GroupBy1 from '@/pages/search/results/groupby/GroupBy.vue';
import GroupBy3 from '@/pages/search/results/groupby/GroupBy3.vue';

import Sort from '@/pages/search/results/Sort.vue';
import BreadCrumbs from '@/pages/search/results/BreadCrumbs.vue';
import Export from '@/pages/search/results/Export.vue';

import Pagination from '@/components/Pagination.vue';
import SelectPicker from '@/components/SelectPicker.vue';

import debug, { debugLog } from '@/utils/debug';

import * as BLTypes from '@/types/blacklabtypes';
import { NormalizedIndex } from '@/types/apptypes';

export default Vue.extend({
	components: {
		Pagination,
		GroupResults,
		HitResults,
		DocResults,
		Totals,
		GroupBy1,
		GroupBy3,
		SelectPicker,
		Sort,
		BreadCrumbs,
		Export
	},
	props: {
		/**
		 * In our case, always 'hits' or 'docs', we don't support adding another ResultsView tab with a different ID.
		 * Since we use this ID to determine whether we're getting hits or docs from blacklab, and some rendering or logic may depend on it being 'hits' or 'docs' as well.
		 */
		id: String as () => 'hits'|'docs',
		label: String,
		active: Boolean,

		store: Object as () => ResultsStore.ViewModule,
	},
	data: () => ({
		isDirty: true, // since we don't have any results yet
		request: null as null|Promise<BLTypes.BLSearchResult>,
		results: null as null|BLTypes.BLSearchResult,
		error: null as null|string,
		cancel: null as null|Api.Canceler,

		_viewGroupName: null as string|null,

		downloadInProgress: false, // csv download
		// exportSummary: false,
		// exportSeparator: false,
		// exportHitMetadata: false,

		paginationResults: null as null|BLTypes.BLSearchResult,

		// Should we scroll when next results arrive - set when main form submitted
		scroll: true,
		// Should we clear the results when we begin the next request? - set when main for submitted.
		clearResults: false,

		originalGroupBySettings: null as null|{
			page: number;
			sort: string|null;
		},

		// temp
		selectedGroupBy: 'GroupBy3',

		debug
	}),
	methods: {
		log: console.log,
		markDirty() {
			this.isDirty = true;
			if (this.cancel) {
				debugLog('cancelling search request');
				this.cancel();
				this.cancel = null;
				this.request = null;
			}
			if (this.active) {
				this.refresh();
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

			if (!this.valid) {
				this.results = null;
				this.paginationResults = null;
				this.error = null;
				this.clearResults = false;
				return;
			}

			if (this.clearResults) { this.results = this.error = null; this.clearResults = false; }

			const params = RootStore.get.blacklabParameters()!;
			const apiCall = this.id === 'hits' ? Api.blacklab.getHits : Api.blacklab.getDocs;
			debugLog('starting search', this.id, params);

			const r = apiCall(this.indexId, params, {headers: { 'Cache-Control': 'no-cache' }});
			this.request = r.request;
			this.cancel = r.cancel;

			setTimeout(() => this.scrollToResults(), 1500);

			this.request
			.then(this.setSuccess, e => this.setError(e, !!params.group))
			.finally(() => this.scrollToResults())
		},
		setSuccess(data: BLTypes.BLSearchResult) {
			debugLog('search results', data);
			this.results = data;
			this.paginationResults = data;
			this.error = null;
			this.request = null;
			this.cancel = null;

			// Jesse (glosses): hier ook een keer de page hits in de gloss store updaten
			const get_hit_id = GlossModule.get.settings()?.get_hit_id;
			if (BLTypes.isHitResults(data) && get_hit_id) {
				GlossModule.actions.setCurrentPage(data.hits.map(get_hit_id));
			}
		},
		setError(data: Api.ApiError, isGrouped?: boolean) {
			if (data.title !== 'Request cancelled') { // TODO
				debugLog('Request failed: ', data);
				this.error = UIStore.getState().global.errorMessage(data, isGrouped ? 'groups' : this.id as 'hits'|'docs');
				this.results = null;
				this.paginationResults = null;
			}
			this.request = null;
			this.cancel= null;
		},

		scrollToResults() {
			if (this.scroll) {
				this.scroll = false;
				window.scroll({
					behavior: 'smooth',
					top: (this.$el as HTMLElement).offsetTop - 150
				});
			}
		},
		leaveViewgroup() {
			this.viewGroup = null;
			this.page = this.originalGroupBySettings?.page || 0;
			this.sort = this.originalGroupBySettings?.sort || null;
			this.originalGroupBySettings = null;
		}
	},
	computed: {
		groupBy: {
			get(): string[] { return this.store.getState().groupBy; },
			set(v: string[]) { this.store.actions.groupBy(v); }
		},
		groupByAdvanced: {
			get(): string[] { return this.store.getState().groupByAdvanced; },
			set(v: string[]) { this.store.actions.groupByAdvanced(v); }
		},
		page: {
			get(): number { const n = this.store.getState().page; console.log('got page', n); return n; },
			set(v: number) { this.store.actions.page(v); console.log('set page', v); }
		},
		sort: {
			get(): string|null { return this.store.getState().sort; },
			set(v: string|null) { this.store.actions.sort(v); }
		},
		viewGroup: {
			get(): string|null { return this.store.getState().viewGroup; },
			set(v: string|null) { this.store.actions.viewGroup(v); }
		},

		corpus(): NormalizedIndex { return CorpusStore.getState().corpus!; },
		sortAnnotations(): string[] { return UIStore.getState().results.shared.sortAnnotationIds; },
		sortMetadata(): string[] { return UIStore.getState().results.shared.sortMetadataIds; },
		exportAnnotations(): string[]|null { return UIStore.getState().results.shared.detailedAnnotationIds; },
		exportMetadata(): string[]|null { return UIStore.getState().results.shared.detailedMetadataIds; },


		exportEnabled(): boolean { return UIStore.getState().results.shared.exportEnabled; },

		refreshParameters(): string {
			/*
				NOTE: we return this as a string so we can remove properties
				If we don't the watcher on this computed will fire regardless
				because some property somewhere in the object is a new instance and thus not equal...
				This would cause new results to be requested even when just changing the table display mode...
			*/
			return jsonStableStringify({
				global: GlobalStore.getState(),
				self: {
					...this.store.getState(),
					groupDisplayMode: null // ignore this property
				} as Partial<ResultsStore.ViewRootState>,
				query: QueryStore.getState()
			});
		},

		// When these change, the form has been resubmitted, so we need to initiate a scroll event
		querySettings() { return QueryStore.getState(); },

		pagination(): {
			shownPage: number,
			maxShownPage: number
		} {
			const r: BLTypes.BLSearchResult|null = this.paginationResults || this.results;
			if (r == null) {
				return {
					shownPage: 0,
					maxShownPage: 0,
				};
			}

			const pageSize = this.results!.summary.requestedWindowSize;
			const shownPage = Math.floor(this.results!.summary.windowFirstResult / pageSize);
			const totalResults =
				BLTypes.isGroups(r) ? r.summary.numberOfGroups :
				BLTypes.isHitResults(r) ? r.summary.numberOfHitsRetrieved :
				r.summary.numberOfDocsRetrieved;

			// subtract one page if number of results exactly diactive by page size
			// e.g. 20 results for a page size of 20 is still only one page instead of 2.
			const pageCount = Math.floor(totalResults / pageSize) - ((totalResults % pageSize === 0 && totalResults > 0) ? 1 : 0);

			return {
				shownPage,
				maxShownPage: pageCount
			};
		},

		valid(): boolean {
			if (this.id === 'hits') {
				const params = RootStore.get.blacklabParameters();
				return !!(params && params.patt);
			} else {
				return true;
			}
		},
		// simple view variables
		indexId(): string { return INDEX_ID; },
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

		viewGroupName(): string {
			if (this.viewGroup == null) { return ''; }
			return this._viewGroupName ? this._viewGroupName :
				this.viewGroup.substring(this.viewGroup.indexOf(':')+1) || '[unknown]';
		},

		breadCrumbs(): Array<{
			label: string,
			title: string,
			active: boolean,
			onClick: () => void
		}> {
			const r = [];
			r.push({
				label: this.id === 'hits' ? 'Hits' : 'Documents',
				title: 'Go back to ungrouped results',
				active: false, //(this.groupBy.length + this.groupByAdvanced.length) === 0,
				onClick: () => {
					this.groupBy = [];
					this.groupByAdvanced = [];
					GlobalStore.actions.sampleSize(null);
				}
			});
			if ((this.groupBy.length + this.groupByAdvanced.length) > 0) {
				r.push({
					label: 'Grouped by ' + this.groupBy.concat(this.groupByAdvanced).toString(),
					title: 'Go back to grouped results',
					active: false, //this.viewGroup == null,
					onClick: () => {
						this.leaveViewgroup();
						GlobalStore.actions.sampleSize(null);
					}
				});
			}
			if (this.viewGroup != null) {
				r.push({
					label: 'Viewing group ' + this.viewGroupName,
					title: '',
					active: false,
					onClick: () => GlobalStore.actions.sampleSize(null)
				});
			}
			const {sampleMode, sampleSize} = GlobalStore.getState();
			if (sampleSize != null) {
				r.push({
					label: `Random sample (${sampleSize}${sampleMode === 'percentage' ? '%' : ''})`,
					title: `Showing only some (${sampleSize}${sampleMode === 'percentage' ? '%' : ''}) results`,
					active: false,
					onClick: () => {
						$('#settings').modal('show')
					}
				})
			}
			r[r.length -1].active = true;
			return r;
		},


		resultComponentName(): string {
			if (this.isGroups) {
				return 'GroupResults';
			} else if (this.isHits) {
				return 'HitResults';
			} else {
				return 'DocResults';
			}
		},
		resultComponentData(): any {
			return {
					results: this.results,
					disabled: !!this.request,
					sort: this.sort,
			};
		},
	},
	watch: {
		querySettings: {
			deep: true,
			handler() {
				this.scroll = true;
				this.clearResults = true;
			},
		},
		refreshParameters: {
			handler(cur, prev) {
				if (this.active) {
					this.refresh();
				} else {
					this.markDirty();
				}
			},
		},
		active: {
			handler(active) {
				if (active && this.isDirty) {
					this.refresh();
				}
			},
			immediate: true
		},
	}
});
</script>

<style lang="scss">

.no-results-found {
	padding: 1.25em;
	text-align: center;
	font-style: italic;
	font-size: 16px;
	color: #777;
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

.results-container {
	position: relative;
}

// Make entire row clickable even when the document title is short
.doctitle {
	display: block;
}

.result-totals {
	background: white;
	padding: 8px 8px 0 15px;
	flex: none;
}

</style>
