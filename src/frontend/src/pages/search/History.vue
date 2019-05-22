<template>
	<div class="modal fade modal-fullwidth" tabindex="-1" ref="modal">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
					<h4 class="modal-title">History</h4>
				</div>
				<div class="modal-body">
					<table class="table table-hover history-table">
						<thead>
							<tr>
								<th width="30px;">#</th>
								<th width="70px;"></th>
								<th width="90px;">Results</th>
								<th>Pattern</th>
								<th>Filters</th>
								<th>Grouping</th>
								<th width="115px"></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(entry, index) in recentHistory" :key="entry.hash + entry.interface.viewedResults">
								<td><strong>{{index + 1}}.</strong></td>
								<td class="text-muted" style="padding-left:0;"><small>{{new Date(entry.timestamp).toLocaleString('nl-NL', {
									hour12: false,
									//year: '2-digit',
									month: '2-digit',
									day: '2-digit',
									hour: 'numeric',
									minute: 'numeric'
								})}}</small></td>
								<td>{{entry.interface.viewedResults === 'hits' ? 'Hits' : 'Documents'}}</td>
								<td class="history-table-contain-text" :title="entry.displayValues.pattern.substring(0,1000) || undefined">{{entry.displayValues.pattern}}</td>
								<td class="history-table-contain-text" :title="entry.displayValues.filters.substring(0,1000) || undefined">{{entry.displayValues.filters}}</td>
								<td class="history-table-contain-text" :title="entry[entry.interface.viewedResults].groupBy.concat(entry[entry.interface.viewedResults].groupByAdvanced).join(' ') || '-'">{{entry[entry.interface.viewedResults].groupBy.concat(entry[entry.interface.viewedResults].groupByAdvanced).join(' ') || '-'}}</td>
								<td>
									<div class="btn-group">
										<button type="button" class="btn btn-default" @click="load(entry)">Search</button>
										<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"><span class="caret"/></button>
										<ul class="dropdown-menu dropdown-menu-right">
											<li><a href="#" @click.prevent="openShareUrl(entry)">Copy as link</a></li>
											<li><a href="#" @click.prevent="downloadAsFile(entry)">Download as file</a></li>
											<li><a href="#" @click.prevent="remove(index)">Delete</a></li>
										</ul>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
					<button v-if="recentHistory.length < history.length" type="button" class="btn btn-default" @click="shownOlderEntries+=5">Load more</button>
				</div>
				<div class="modal-footer">
					<form v-if="importUrlVisible" @submit.prevent.stop="importFromUrl" :name="`${uid}_import`" class="history-table-import-url">
						<div class="input-group" style="width: 100%;">
							<input type="url" class="form-control" autocomplete="off" autofocus placeholder="Copy your url here" ref="importUrlInput"/>
							<span class="input-group-btn"><button type="submit" class="btn btn-primary">Import url</button></span>
						</div>
						<div v-if="importUrlError" class="text-danger">{{importUrlError}}</div>
					</form>
					<button v-else class="btn btn-link btn-open-import" @click="importUrlVisible = !importUrlVisible"><span class="fa fa-lg fa-plus"></span> Import from a link</button>
					<button type="button" name="closeSettings" class="btn btn-primary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>

		<form v-if="isSharingUrl" class="history-popup" @click.self="closeShareUrl">
			<div class="history-popup-content">
				<input type="text" class="form-control" :value="sharingUrl" autocomplete="off" autofocus readonly ref="shareUrlInput"/>
			</div>
		</form>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';
import $ from 'jquery';

import {saveAs} from 'file-saver';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as HistoryStore from '@/store/search/history';
import * as FilterStore from '@/store/search/form/filters';

import UrlStateParser from '@/store/search/util/url-state-parser';

import UID from '@/mixins/uid';

import * as BLTypes from '@/types/blacklabtypes';

export default Vue.extend({
	mixins: [UID],
	data: () => ({
		sessionStart: new Date().getTime(),
		shownOlderEntries: 0,
		sharingUrl: null as null|string,
		importUrlError: null as null|string,
		importUrlVisible: false,
	}),
	computed: {
		history(): HistoryStore.ModuleRootState { return HistoryStore.getState() },
		recentHistory(): HistoryStore.ModuleRootState {
			let olderEntryCount = 0;
			return this.history.filter((e: HistoryStore.FullHistoryEntry, i) => (e.timestamp >= this.sessionStart) || (olderEntryCount++) < this.shownOlderEntries || i < 2);
		},
		isSharingUrl(): boolean { return this.sharingUrl != null; },
	},

	methods: {
		remove(index: number): void { HistoryStore.actions.removeEntry(index); },
		openShareUrl(entry: HistoryStore.FullHistoryEntry) { this.sharingUrl = entry.url; },
		closeShareUrl() { this.sharingUrl = null; },

		downloadAsFile(entry: HistoryStore.FullHistoryEntry) {
			const {file, fileName} = HistoryStore.get.asFile(entry);
			saveAs(file, fileName);
		},

		load(entry: HistoryStore.HistoryEntry) {
			$(this.$refs.modal).modal('toggle');
			RootStore.actions.replace(entry);
		},

		importFromUrl() {
			const input = (this.$refs.importUrlInput as HTMLInputElement);
			const importUrl = input.value;
			if (!importUrl) {
				this.importUrlError = null;
				this.importUrlVisible = false;
			}
			if (!input.checkValidity()) {
				this.importUrlError = 'Invalid url';
				return;
			}

			const uri = new URI(importUrl);
			const state = new UrlStateParser(FilterStore.getState().filters, uri).get();
			HistoryStore.actions.addEntry({
				entry: state,
				pattern: (uri.query(true) as any).patt,
				url: importUrl,
			});

			this.importUrlError = null;
			this.importUrlVisible = false;
		},
	},
	watch: {
		isSharingUrl(value: boolean) {
			if (value) {
				Vue.nextTick(() => {
					const input = (this.$refs.shareUrlInput as HTMLInputElement);
					input.focus();
					input.setSelectionRange(0, input.value.length);
				});
			}
		}
	}
});
</script>

<style lang="scss">

#history {
	.modal-content {
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 60px);
		min-height: 300px;
	}

	.modal-header {
		flex: none;
	}
	.modal-body {
		flex: 1 1 auto;
		overflow: auto;
		padding-bottom: 110px;
	}
	.modal-footer {
		flex: none;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;

		.history-table-import-url {
			flex-grow: 1;
			margin-right: 25px;
		}
	}
}

.history-table {
	margin: 0;
	min-width: 500px;
	td, th {
		white-space: nowrap;
	}
	.history-{
		&index { display: table-cell; }
		&date {
			display: table-cell;
			text-align: right;
			width: 100%;
		}
	}
}

.history-table-contain-text {
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
}

.history-popup {
	position: fixed;
	top: 0;
	bottom: 0;
	left: 0;
	right: 0;
	background-color: rgba(0,0,0,0.25);
	z-index: 10000;
	>.history-popup-content {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		max-width: 1170px;
		width: 80%;
		background: white;
		border-radius: 6px;

		>.history-popup-header {
			text-align: right;
		}
	}
}

.btn-open-import {
	padding-left: 6px;
	padding-right: 6px;
	width: 100%;
	text-align: left;
}

.history-dropdown {
	> .dropdown-menu {
		left: auto;
		right: 0;
	}
}

</style>
