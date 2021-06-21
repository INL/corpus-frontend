<template>
	<div class="modal fade" tabindex="-1">
		<div class="modal-dialog">
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
									data-id="resultsPerPage"
									data-name="resultsPerPage"
									hideEmpty

									:options="pageSizeOptions"

									v-model="pageSize"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="sampleSize" class="col-xs-3">Sample size:</label>
							<div class="col-xs-9">
								<div class="input-group">
									<SelectPicker
										class="input-group-btn"
										data-id="sampleMode"
										data-name="sampleMode"
										data-menu-width="grow"

										hideEmpty
										:options="sampleModeOptions"

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
								<input id="wordsAroundHit" name="wordsAroundHit" placeholder="Context size" type="number" class="form-control" v-model.lazy="wordsAroundHit">
							</div>
						</div>
					</div>
					<hr>
					<div class="checkbox-inline"><label for="wide-view"><input type="checkbox" id="wide-view" name="wide-view" data-persistent checked> Wide View</label></div>
					<br>
					<div v-if="debug.debug_visible || debug.debug" class="checkbox-inline"><label for="debug" class="text-muted"><input type="checkbox" id="debug" name="debug" v-model="debug.debug"> Debug info</label></div>
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

import * as RootStore from '@/store/search/';
import * as GlobalViewSettings from '@/store/search/results/global';
import * as ResultsViewSettings from '@/store/search/results';

import SelectPicker,{ Option } from '@/components/SelectPicker.vue';

import debug from '@/utils/debug';

export default Vue.extend({
	components: {
		SelectPicker,
	},
	data: (): {
		sampleModeOptions: Array<GlobalViewSettings.ModuleRootState['sampleMode']>,
		pageSizeOptions: Option[],
		debug: typeof debug
	} => ({
		sampleModeOptions: ['percentage', 'count'],
		pageSizeOptions: ['20','50','100','200'].map(value => ({value, label: `${value} results`})),
		debug
	}),
	computed: {
		viewedResultsSettings: RootStore.get.viewedResultsSettings,
		pageSize: {
			get(): string { return this.itoa(GlobalViewSettings.getState().pageSize); },
			set(v: string) {
				GlobalViewSettings.actions.pageSize(this.atoi(v)!);
				ResultsViewSettings.actions.resetPage();
			}
		},
		sampleMode: {
			get() { return GlobalViewSettings.getState().sampleMode; },
			set(v: GlobalViewSettings.ModuleRootState['sampleMode']) {
				GlobalViewSettings.actions.sampleMode(v);
				ResultsViewSettings.actions.resetPage();
			}
		},
		sampleSize: {
			get(): string { return this.itoa(GlobalViewSettings.getState().sampleSize); },
			set(v: string) {
				GlobalViewSettings.actions.sampleSize(this.atoi(v));
				ResultsViewSettings.actions.resetPage();
			}
		},
		sampleSeed: {
			get(): string { return this.itoa(GlobalViewSettings.getState().sampleSeed); },
			set(v: string) {
				GlobalViewSettings.actions.sampleSeed(this.atoi(v));
				if (this.viewedResultsSettings && (this.viewedResultsSettings.groupBy.length || this.viewedResultsSettings.groupByAdvanced.length)) {
					// No need to do this when ungrouped - the raw number of results
					// will stay as it is, but the distribution (and number of) groups may change and
					// cause the number of pages to shift
					ResultsViewSettings.actions.resetPage();
				}
			}
		},
		wordsAroundHit: {
			get(): string { return this.itoa(GlobalViewSettings.getState().wordsAroundHit); },
			set(v: string) { GlobalViewSettings.actions.wordsAroundHit(this.atoi(v)); }
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