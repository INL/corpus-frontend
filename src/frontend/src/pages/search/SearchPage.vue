<template>
	<div class="container">

		<SearchForm class="row cf-panel cf-panel-lg" id="mainForm"/>
		<QuerySummary v-if="viewedResults" class="cf-panel cf-panel-lg" id="summary"/>
		<Results v-show="viewedResults" id="results"/>

		<!-- TODO -->
		<div id="settingsModal" class="modal fade" tabindex="-1" role="dialog">
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
											v-model="sampleMode"
										/>

										<input id="sampleSize" name="sampleSize" placeholder="sample size" type="number" class="form-control" v-model.lazy="sampleSize"/>
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

							<div class="checkbox-inline"><label for="wide-view"><input type="checkbox" id="wide-view" name="wide-view" data-persistent> Wide View</label></div>
						</div>

					</div>
					<div class="modal-footer">
						<button type="button" name="closeSettings" class="btn btn-primary" data-dismiss="modal">Close</button>
					</div>
				</div>
			</div>
		</div>

		<PageGuide/>
		<History/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import $ from 'jquery';

import * as RootStore from '@/store';
import * as SettingsStore from '@/store/settings';

import SearchForm from '@/pages/search/form/SearchForm.vue';
import QuerySummary from '@/pages/search/results/QuerySummary.vue';
import Results from '@/pages/search/results/Results.vue';

import SelectPicker from '@/components/SelectPicker.vue';

import PageGuide from '@/pages/search/PageGuide.vue';
import History from '@/pages/search/History.vue';

export default Vue.extend({
	components: {
		SearchForm,
		QuerySummary,
		Results,
		PageGuide,
		History,

		SelectPicker
	},
	computed: {
		viewedResults: RootStore.get.viewedResults,
		pageSize: {
			get(): string { return SettingsStore.getState().pageSize + ''; },
			set(v: string) { SettingsStore.actions.pageSize(Number.parseInt(v, 10)); }
		},
		sampleMode: {
			get() { return SettingsStore.getState().sampleMode; },
			set(v: string) { return SettingsStore.actions.sampleMode(v); }
		},
		sampleSize: {
			get() { return SettingsStore.getState().sampleSize; },
			set(v: number) { SettingsStore.actions.sampleSize(v); }
		},
		sampleSeed: {
			get() { return SettingsStore.getState().sampleSeed; },
			set(v: number) { SettingsStore.actions.sampleSeed(v); }
		},
		wordsAroundHit: {
			get() { return SettingsStore.getState().wordsAroundHit; },
			set(v: number) { SettingsStore.actions.wordsAroundHit(v); }
		}
	},

	mounted() {
		$(document).trigger('vue-root-mounted');
	}
})

</script>

<style lang="scss">

</style>