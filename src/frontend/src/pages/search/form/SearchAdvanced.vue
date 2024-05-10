<template>
	<div>
		<template v-if="!isParallelCorpus">
			<!-- Regular (non-parallel) corpus -->
			<div id="querybuilder" class="querybuilder"></div>
		</template>
		<div v-else class="parallel">
			<!-- Parallel corpus -->
			<label class="control-label" for="sourceVersion">{{$t('search.parallel.queryForSourceVersion')}}
				<SelectPicker id="sourceVersion" :options="parallelSourceVersionOptions"
					v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
			</label>
			<div id="querybuilder" class="querybuilder"></div>

			<div v-for="(version, index) in parallelTargetVersions" :key="version">
				<label class="control-label">{{$t('search.parallel.queryForTargetVersion')}}
					<span @click="removeTargetVersion(version)" class="targetVersion" :title="$t('widgets.clickToRemove').toString()" href="#">
						{{versionDisplayName(version)}}
					</span>
				</label>
				<div :id="`querybuilder-target-${version}`" class="querybuilder"></div>
			</div>

			<label class="control-label">
				{{ parallelTargetVersions && parallelTargetVersions.length > 0 ?
				$t('search.parallel.addTargetVersion') :
				$t('search.parallel.chooseTargetVersion')
				}}</label>
			<div>
				<SelectPicker :options="parallelTargetVersionOptions" @input="addTargetVersion($event)" />
			</div>
		</div>

	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as PatternStore from '@/store/search/form/patterns';

import SelectPicker, { Option } from '@/components/SelectPicker.vue';
import MultiValuePicker from '@/components/MultiValuePicker.vue';
import { initQueryBuilders } from '@/initQueryBuilders';

export default Vue.extend({
	components: {
		SelectPicker,
		MultiValuePicker
	},
	data: () => ({
	}),
	computed: {
		isParallelCorpus: CorpusStore.get.isParallelCorpus,
		parallelSourceVersionOptions: PatternStore.get.parallelSourceVersionOptions,
		parallelTargetVersionOptions: PatternStore.get.parallelTargetVersionOptions,
		parallelSourceVersion: {
			get() { return PatternStore.get.parallelVersions().source; },
			set: PatternStore.actions.parallelVersions.sourceVersion
		},
		parallelTargetVersions: {
			get() { return PatternStore.get.parallelVersions().targets; },
			set: PatternStore.actions.parallelVersions.targetVersions
		},

		mainQuery: {
			get() { return PatternStore.getState().expert.query || undefined; },
			set: PatternStore.actions.expert.query,
		},
		targetQueries: {
			get() { return PatternStore.getState().expert.targetQueries; },
			set: PatternStore.actions.expert.targetQueries,
		},

	},
	methods: {
		addTargetVersion(version: string) {
			if (version != null) // can happen when select is reset to empty option
				PatternStore.actions.parallelVersions.addTarget(version);

			// init
			setTimeout(() => {
				initQueryBuilders();
			}, 100);
		},
		removeTargetVersion: PatternStore.actions.parallelVersions.removeTarget,
		versionDisplayName: (version: string): string =>
			CorpusStore.get.parallelVersionOptions().find(v => v.value === version)?.label || version,
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

#querybox {
	width: 100%;
	resize: none;
	margin-bottom: 10px;
}

.parallel {
	margin: 15px 0;

	label {
		margin-top: 10px;
	}
	textarea, #querybox {
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
}

</style>