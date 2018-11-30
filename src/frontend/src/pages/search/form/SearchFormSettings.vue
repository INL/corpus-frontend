<template>
	<div class="modal fade" tabindex="-1" role="dialog">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
					<h4 class="modal-title">Global settings</h4>
				</div>
				<div class="modal-body">
					<div class="form-horizontal">

						<div class="form-group"> <!-- behaves as .row when in .form-horizontal so .row may be omitted -->
							<label for="resultsPerPage" class="col-xs-3">Results per page:</label>
							<div class="col-xs-9">
								<SelectPicker
									id="resultsPerPage"
									name="resultsPerPage"

									data-width="auto"
									data-style="btn-default"

									:options="['20','50','100','200'].map(value => ({value, label: `${value} results`}))"

									v-model="pageSize"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="sampleSize" class="col-xs-3">Sample size:</label>
							<div class="col-xs-9">
								<div class="input-group">
									<SelectPicker
										id="sampleMode"
										name="sampleMode"
										class="input-group-btn"

										data-width="auto"
										data-style="btn-default"

										:options="['percentage', 'count'].map(o => ({value: o}))"

										@input="focusSampleSize"

										v-model="sampleMode"
									/>

									<input id="sampleSize" name="sampleSize" placeholder="sample size" type="number" class="form-control" v-model.lazy="sampleSize" ref="sampleSize"/>
								</div>
							</div>
						</div>

						<div class="form-group">
							<label for="sampleSeed" class="col-xs-3">Seed:</label>
							<div class="col-xs-9">
								<input id="sampleSeed" name="sampleSeed" placeholder="seed" type="number" class="form-control" v-model.lazy="sampleSeed">
							</div>
						</div>

						<div class="form-group">
							<label for="wordsAroundHit" class="col-xs-3">Context size:</label>
							<div class="col-xs-9">
								<input id="wordsAroundHit" name="wordsAroundHit" placeholder="context Size" type="number" class="form-control" v-model.lazy="wordsAroundHit">
							</div>
						</div>

						<hr>

						<div class="checkbox-inline"><label for="wide-view"><input type="checkbox" id="wide-view" name="wide-view" data-persistent checked> Wide View</label></div>
					</div>

				</div>
				<div class="modal-footer">
					<button type="button" name="closeSettings" class="btn btn-primary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>

</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store';
import * as SettingsStore from '@/store/settings';
import * as ResultsStore from '@/store/results';

import SelectPicker from '@/components/SelectPicker.vue';

export default Vue.extend({
	components: {
		SelectPicker,
	},
	computed: {
		viewedResultsSettings: RootStore.get.viewedResultsSettings,
		pageSize: {
			get(): string { return this.itoa(SettingsStore.getState().pageSize); },
			set(v: string) {
				SettingsStore.actions.pageSize(this.atoi(v)!);
				ResultsStore.actions.resetPage();
			}
		},
		sampleMode: {
			get() { return SettingsStore.getState().sampleMode; },
			set(v: string) {
				SettingsStore.actions.sampleMode(v);
				ResultsStore.actions.resetPage();
			}
		},
		sampleSize: {
			get(): string { return this.itoa(SettingsStore.getState().sampleSize); },
			set(v: string) {
				SettingsStore.actions.sampleSize(this.atoi(v));
				ResultsStore.actions.resetPage();
			}
		},
		sampleSeed: {
			get(): string { return this.itoa(SettingsStore.getState().sampleSeed); },
			set(v: string) {
				SettingsStore.actions.sampleSeed(this.atoi(v));
				if (this.viewedResultsSettings && (this.viewedResultsSettings.groupBy.length || this.viewedResultsSettings.groupByAdvanced.length)) {
					// No need to do this when ungrouped - the raw number of results
					// will stay as it is, but the distribution (and number of) groups may change and
					// cause the number of pages to shift
					ResultsStore.actions.resetPage();
				}
			}
		},
		wordsAroundHit: {
			get(): string { return this.itoa(SettingsStore.getState().wordsAroundHit); },
			set(v: string) { SettingsStore.actions.wordsAroundHit(this.atoi(v)); }
		},
	},
	methods: {
		focusSampleSize() {
			(this.$refs.sampleSize as HTMLInputElement).focus()
		},

		itoa(n: number|null): string { return n == null ? '' : n.toString(); },
		atoi(s: string): number|null { return s ? Number.parseInt(s, 10) : null; }
	},
})
</script>