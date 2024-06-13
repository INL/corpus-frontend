<template>
	<div>
		<template v-if="!isParallelCorpus">
			<!-- Regular (non-parallel) corpus -->
			<div class="querybuilder"></div>
		</template>
		<div v-else>
			<!-- Parallel corpus -->
			<div class="qb-par-wrap">
				<label class="control-label" for="sourceVersion">{{$t('search.parallel.queryForSourceVersion')}}
					<SelectPicker id="sourceVersion" :options="parallelSourceVersionOptions"
						v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
				</label>
				<div class="querybuilder"></div>
			</div>
			<div v-for="(version, index) in parallelTargetVersions" :key="version">
				<div class="qb-par-wrap">
					<label class="control-label">{{$t('search.parallel.queryForTargetVersion')}}
						<span @click="removeTargetVersion(version)" class="targetVersion" :title="$t('widgets.clickToRemove').toString()" href="#">
							{{versionDisplayName(version)}}
						</span>
					</label>
					<div class="querybuilder"></div>
				</div>
			</div>

			<div class="add-target-version">
				<label class="control-label">
					{{ parallelTargetVersions && parallelTargetVersions.length > 0 ?
					$t('search.parallel.addTargetVersion') :
					$t('search.parallel.chooseTargetVersion')
					}}</label>
				<div>
					<SelectPicker :options="parallelTargetVersionOptions" @input="addTargetVersion($event)" />
				</div>
			</div>

			<div class="align-by">
				<label class="control-label">{{ $t('search.parallel.alignBy') }}</label>
				<div>
					<div class="btn-group">
						<AlignBy />
					</div>
				</div>
			</div>
		</div>

		<button type="button" class="btn btn-default btn-sm" @click="copyAdvancedQuery">{{$t('search.advanced.copyAdvancedQuery')}}</button>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as PatternStore from '@/store/search/form/patterns';
import * as InterfaceStore from '@/store/search/form/interface';

import SelectPicker, { Option } from '@/components/SelectPicker.vue';
import MultiValuePicker from '@/components/MultiValuePicker.vue';
import AlignBy from '@/pages/search/form/AlignBy.vue';
import { initQueryBuilders } from '@/initQueryBuilders';

export default Vue.extend({
	components: {
		SelectPicker,
		MultiValuePicker,
		AlignBy,
	},
	data: () => ({
	}),
	computed: {
		// Is this a parallel corpus?
		isParallelCorpus: CorpusStore.get.isParallelCorpus,

		// If this is a parallel corpus: the available source version options (all except chosen targets)
		parallelSourceVersionOptions: PatternStore.get.parallelSourceVersionOptions,

		// If this is a parallel corpus: the available target version options (all except chosen sources and targets)
		parallelTargetVersionOptions() {
			return PatternStore.get.parallelTargetVersionOptions().filter(v =>
				!this.parallelTargetVersions.includes(v.value));
		},

		// If this is a parallel corpus: the currently selected source version
		parallelSourceVersion: {
			get() { return PatternStore.get.parallelVersions().source; },
			set: PatternStore.actions.parallelVersions.sourceVersion
		},

		// If this is a parallel corpus: the currently selected target versions
		parallelTargetVersions: {
			get() { return PatternStore.get.parallelVersions().targets; },
			set: PatternStore.actions.parallelVersions.targetVersions
		},

		// The query (or source query, for parallel corpora)
		mainQuery: {
			get() { return PatternStore.getState().advanced.query || undefined; },
			set: PatternStore.actions.advanced.query,
		},

		// If this is a parallel corpus: the target queries
		targetQueries: {
			get() {
				const queries = PatternStore.getState().expert.targetQueries;
				return queries.map(q => q == null || q == '_' || q == '[]*' ? '' : q);
			},
			set: PatternStore.actions.advanced.targetQueries,
		},

	},
	methods: {
		addTargetVersion(version: string) {
			if (version != null) // can happen when select is reset to empty option
				PatternStore.actions.parallelVersions.addTarget(version);
		},

		removeTargetVersion: PatternStore.actions.parallelVersions.removeTarget,

		versionDisplayName: (version: string): string =>
			CorpusStore.get.parallelVersionOptions().find(v => v.value === version)?.label || version,

		copyAdvancedQuery() {
			const q = PatternStore.getState().advanced.query;
			PatternStore.actions.expert.query(q);
			for (let i = 0; i < PatternStore.getState().advanced.targetQueries.length; i++) {
				PatternStore.actions.expert.changeTargetQuery({
					index: i,
					value: PatternStore.getState().advanced.targetQueries[i]
				});
			}
			InterfaceStore.actions.patternMode('expert');
		},
	},
	watch: {
		parallelTargetVersions() {
			setTimeout(initQueryBuilders, 100); // TODO: setTimeout necessary or not?
		}
	}
});
</script>

<style lang="scss" scoped>

h3 .help {
	font-size: 0.8em;

	// superscript
	position: relative;
	top: -0.5em;
	color: black;
	opacity: 0.5;
}

.parallel {
	margin: 15px 0;

	label {
		margin-top: 10px;
	}
	textarea/*, .querybox*/ {
		width: 100%;
		resize: none;
		margin: 0;
	}
	#sourceVersion, .targetVersion {
		font-weight: normal;
	}
	span.targetVersion {
		display: inline-block;
		margin: 2px;
		user-select: none;

		// position: relative;
		// top: 1px;

		background-color: lighten(#337ab7, 40); // $panel-color (global.scss); maybe separate variables into file we can import here?
		color: black;
		padding: 7px;
		border-radius: 3px;
		cursor: pointer;
		&::after {
			font-weight: bold;
			content: '✕';
			margin-left: 5px;
		}
	}

	.add-target-version, .align-by {
		margin-bottom: 20px;

		label { display: block; }
	}
}

</style>