<template>
	<div class="history">
		<a class="btn btn-lg history-button" href="#history-modal" data-toggle="modal">Open history</a>

		<div id="history-modal" class="modal fade modal-fullwidth" tabindex="-1" role="dialog" ref="modal">
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
									<th width="40px;">#</th>
									<th width="90px;">Results</th>
									<th>Pattern</th>
									<th>Filters</th>
									<th>Grouping</th>
									<th width="115px"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(entry, index) in history" :key="entry.hash">
									<td><strong>{{index + 1}}.</strong></td>
									<td>{{entry.viewedResults === 'hits' ? 'Hits' : 'Documents'}}</td>
									<td class="history-table-contain-text" :title="entry.displayValues.pattern.substring(0,1000) || undefined">{{entry.displayValues.pattern}}</td>
									<td class="history-table-contain-text" :title="entry.displayValues.filters.substring(0,1000) || undefined">{{entry.displayValues.filters}}</td>
									<td class="history-table-contain-text" :title="entry.groupBy.concat(entry.groupByAdvanced).join(' ') || '-'">{{entry.groupBy.concat(entry.groupByAdvanced).join(' ') || '-'}}</td>
									<td>
										<div class="btn-group">
											<button type="button" class="btn btn-default" @click="load(entry)">Search</button>
											<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"><span class="caret"/></button>
											<ul class="dropdown-menu">
												<li><a href="#" @click.prevent="openShareUrl(entry)">Copy link</a></li>
												<li><a href="#" @click.prevent="remove(index)">Delete</a></li>
											</ul>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
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
	</div>

</template>

<script lang="ts">
import Vue from 'vue';
import URI from 'urijs';
import $ from 'jquery';

import * as HistoryStore from '@/store/history';
import * as RootStore from '@/store';
import * as CorpusStore from '@/store/corpus';

import UID from '@/mixins/uid';
import {getUrlFromHistoryEntry, getHistoryEntryFromState, makeWildcardRegex, makeRegexWildcard, getPatternString} from '@/utils';

import * as BLTypes from '@/types/blacklabtypes';

export default Vue.extend({
	mixins: [UID],
	data: () => ({
		sharingUrl: null as null|string,
		importUrlError: null as null|string,
		importUrlVisible: false,
	}),
	computed: {
		history(): HistoryStore.ModuleRootState { return HistoryStore.getState() },
		isSharingUrl(): boolean { return this.sharingUrl != null; },
	},

	methods: {
		remove(index: number): void { HistoryStore.actions.removeEntry(index); },
		openShareUrl(entry: HistoryStore.HistoryEntry) { this.sharingUrl = getUrlFromHistoryEntry(entry); },
		closeShareUrl() { this.sharingUrl = null; },

		load(entry: HistoryStore.HistoryEntry) {
			$(this.$refs.modal).modal('toggle');
			RootStore.actions.replaceFromHistory(entry);
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

			try {
				const uri = new URI(importUrl);
				const state = new RootStore.UrlPageState(uri).get();

				/*
					TODO this is ugly
					because the state as parsed from the url does not have the form submitted yet
					the submittedParameters are null
					the history store assumes this not to be the case
					manually correct this for now.
					See store/form::actions.search
				*/

				const submitted: RootStore.RootState['form']['submittedParameters'] = {
					filters: Object.values(state.form.filters),
					pattern: null
				};

				switch (state.form.activePattern) {
					case 'simple': submitted.pattern = getPatternString({
						// Note: emulate an annotatedField here so the string processing is the same
						// this generates a cql query where wildcards etc are properly escaped
						// which is important when restoring from history, as we only have the query
						// and we don't know whether it came from the querybuilder, the simple field, or the expert field.
						annotations: [{
							annotatedFieldId: CorpusStore.get.firstMainAnnotation().annotatedFieldId,
							id: CorpusStore.get.firstMainAnnotation().id,
							value: state.form.pattern.simple || '',
							case: false,
						}],
						within: null,
					}) || null; break;
					case 'extended': {
						const activeAnnotations = Object.values(state.form.pattern.extended.annotationValues);
						if (activeAnnotations.length) {
							submitted.pattern = {
								annotations: JSON.parse(JSON.stringify(activeAnnotations)) as typeof activeAnnotations,
								within: state.form.pattern.extended.within
							};
						} // else no annotations active, keep submitted.pattern as null.
					}
					case 'advanced': submitted.pattern = state.form.pattern.advanced || null; break;
					case 'expert': submitted.pattern = state.form.pattern.expert || null; break;
				}

				state.form.submittedParameters = submitted;
				state.viewedResults = state.viewedResults || (submitted.pattern ? 'hits' : 'docs');

				HistoryStore.actions.addEntry(state);
				this.importUrlError = null;
				this.importUrlVisible = false;
			} catch (e) {
				this.importUrlError = 'Invalid url: ' + e.message;
			}
		}
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

#history-modal {
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
	td, th {
		white-space: nowrap;
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
