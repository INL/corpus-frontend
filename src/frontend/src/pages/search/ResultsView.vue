<template>
	<div v-show="active">
		<div class="resultcontrols">
			<div class="top">
				<div class="grouping">
					<div class="groupselect-container">

						<select-picker v-model="groupBy"
							:options="optGroups"
							multiple
							class="groupselect"
							title="Group hits by..."
							data-size="15"
							data-actions-box="true"
							data-deselect-all-text="reset"
							data-show-subtext="true"
							data-style="btn-default btn-sm"
						/>

						<button type="button" class="btn btn-sm btn-default dummybutton">update</button> <!-- dummy button... https://github.com/INL/corpus-frontend/issues/88 -->
						<div class="checkbox-inline" style="margin-left: 5px;">
							<label title="Separate groups for differently cased values" style="white-space: nowrap; margin: 0;" :for="uid+'case'"><input type="checkbox" :id="uid+'case'" v-model="caseSensitive">Case sensitive</label>
						</div>
					</div>

					<div v-if="viewGroup"
						class="btn btn-sm btn-default nohover viewgroup"
					>
						<span class="fa fa-exclamation-triangle text-danger"></span> Viewing group <span class="name">{{viewGroup}}</span> &mdash; <a class="clear" @click="viewGroup = null">Go back</a>
					</div>

					<div v-if="results && !!(results.summary.stoppedRetrievingHits && !results.summary.stillCounting)"
						class="btn btn-sm btn-default nohover toomanyresults"
						style="border-radius: 100px;"
					>
						<span class="fa fa-exclamation-triangle text-danger"></span> Too many results! &mdash; your query was limited
					</div>
				</div>

				<div class="buttons">
					<button type="button" class="btn btn-default btn-sm pull-right" style="margin-left: 5px;margin-bottom: 5px;">Export CSV</button>
					<button v-if="type === 'hits' && !isGroups" type="button" class="btn btn-danger btn-sm pull-right" style="margin-left: 5px;margin-bottom: 5px;">Show/hide titles</button>
				</div>
			</div>

			<ul class="pagination pagination-sm">
				<li v-for="i in pages" :key="i" :class="{'current': i === currentPage}">
					<input v-if="i === currentPage" type="text" class="form-control"
						:value="currentPage+1"
						@input="userSubmittedPage = $event.target.value-1"
						@keypress.enter.prevent="(userSubmittedPage !== currentPage) ? page = userSubmittedPage : undefined"
					/>
					<a v-else @click="page = i">{{i+1}}</a>
				</li>
			</ul>
		</div>

		<span v-if="request" class="fa fa-spinner fa-spin searchIndicator" style="position:absolute; left: 50%; top:15px"></span>

		<div v-if="results" class="lightbg haspadding resultcontainer">
			<GroupResults v-if="isGroups"
				:results="results"
				:sort="sort"

				@sort="sort = $event"
				@viewgroup="viewGroup = $event"
			/>
			<HitResults v-else-if="isHits"
				:results="results"
				:sort="sort"

				@sort="sort = $event"
			/>
			<DocResults v-else
				:results="results"
				:sort="sort"

				@sort="sort = $event"
			/>
		</div>
	</div>

</template>

<script lang="ts">
import Vue from "vue";

import uid from '@/mixins/uid';

import * as resultsStore from '@/store/results';
import * as settingsStore from '@/store/settings';
import * as globalStore from '@/store';
import * as corpus from '@/store/corpus';
import * as query from '@/store/form';

import * as bls from "@/modules/singlepage-bls";
import * as BLTypes from '@/types/blacklabtypes';

import SelectPicker, {OptGroup} from '@/components/SelectPicker.vue';
import GroupResults from '@/pages/search/GroupResults.vue';
import HitResults from '@/pages/search/HitResults.vue';
import DocResults from '@/pages/search/DocResults.vue';

import {onSearchUpdated} from '@/search';

export default Vue.extend({
	mixins: [uid],
	components: {
		SelectPicker,
		GroupResults,
		HitResults,
		DocResults
	},
	props: {
		type: String as () => 'hits'|'docs',
	},
	data: () => ({
		isDirty: true, // since we don't have any results yet
		request: null as null|Promise<BLTypes.BLSearchResult>,
		results: null as null|BLTypes.BLSearchResult,
		error: null as null|BLTypes.BLError, // TODO not correct

		userSubmittedPage: null as number|null,
	}),
	methods: {
		markDirty() {
			this.isDirty = true;
		},
		refresh() {
			this.isDirty = false;
			console.log('this is when the search should be refreshed');
			const params = bls.getBlsParamFromState();

			this.request = new Promise<BLTypes.BLSearchResult>((resolve, reject) => {
				bls.search(this.type, bls.getBlsParamFromState(), resolve, () => reject(arguments));
			});
			this.request.then(this.setSuccess, this.setError);
			onSearchUpdated(this.type, params);
		},
		setSuccess(data: BLTypes.BLSearchResult) {
			this.results = data;
			this.error = null;
			this.request = null;
			this.userSubmittedPage = null;
		},
		setError(data: BLTypes.BLError) {
			this.error = data;
			this.results = null;
			this.request = null;
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
				querySettings: query.get.lastSubmittedPattern()
			}
		},

		// Calculated fields
		optGroups(): OptGroup[] {
			const groups: OptGroup[] = [];

			const metadataGroups = corpus.get.metadataGroups();
			if (this.type === 'hits') {
				const annotations = corpus.get.annotations();

				[['wordleft:', 'Before hit'],['hit:', 'Hit'],['wordright:', 'After hit']]
				.forEach(([prefix, label]) =>
					groups.push({
						label,
						options: annotations.map(annot => ({
							label: `Group by ${annot.displayName} <small class="text-muted">${label.split(' ')[0].toLowerCase()}</small>`,
							value: `${prefix}${annot.id}`
						}))
					})
				);
			}
			metadataGroups.forEach(group => groups.push({
				label: group.name,
				options: group.fields.map(field => ({
					label: (field.displayName || field.fieldName).replace(group.name, ''),
					value: `field:${field.fieldName}`
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
		/** NOTE: might be out of bounds */
		currentPage(): number {
			if (this.results == null) {
				return 0;
			} else {
				const pageSize = this.results.summary.requestedWindowSize;
				const currentPage = Math.min(Math.ceil(this.results.summary.windowFirstResult / pageSize), this.totalPages);
				return currentPage;
			}
		},
		totalPages(): number {
			if (this.results == null) {
				return 0;
			} else {
				return Math.ceil(this.totalResults / this.results.summary.requestedWindowSize);
			}
		},

		pages(): number[] {
			if (!this.results) {
				return [];
			}
			// TotalPages is 1-indexed, while the page indices we return are 0-indexed, hence the page < totalPages and not page <= totalPages.
			const pages = [-10, -5, -1, 0, 1, 5, 10].map(offset => this.currentPage + offset).filter(page => page >= 0 && page < this.totalPages);
			return pages;
		},

		active() {
			return globalStore.get.viewedResults() === this.type;
		},

		isHits() { return BLTypes.isHitResults(this.results); },
		isDocs() { return BLTypes.isDocResults(this.results); },
		isGroups() { return BLTypes.isGroups(this.results); },
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
		justify-content: space-between;

		>.grouping {
			display: flex;
			flex-wrap: wrap;
			min-width: 220px;
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

				li a {
					text-transform: capitalize;
				}
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
		}
	}
}
.pagination {
	>li {
		display: inline-block;
		> input {
			border-radius: 0;
			border-color: #4c91cd;
			box-shadow: inset 0px 0px 0px 1px hsla(208, 56%, 46%, 0.3);
			// background-color: #337ab7;
			// border-color: #337ab7;
			// color: #222;
			color: #337ab7;
			font-size: 12px;
			height: auto;
			line-height: 1.5;
			padding: 5px;
			// text-decoration: underline;
			// width: 3em;
			text-align: center;
			width: 34px;
			z-index: 1;
		}
		> input:focus {
			text-decoration: none;
		}
		>a {
			cursor: pointer;
		}
	}
	li.current+li>a {
		border-left-width: 0px;
		margin-left: 0;
	}
}

</style>