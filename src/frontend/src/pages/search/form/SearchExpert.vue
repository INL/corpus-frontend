<template>
	<div>
		<h3>{{$t('search.expert.corpusQueryLanguage') + (isParallelCorpus ? '' : ':') }}
			<a class='help' target='_blank' href='https://inl.github.io/BlackLab/guide/corpus-query-language.html'
				:title="$t('widgets.learnMore').toString()">🛈</a>
		</h3>
		<template v-if="!isParallelCorpus">
			<!-- Regular (non-parallel) corpus -->
			<textarea class="form-control querybox" name="querybox" rows="7" v-model="mainQuery"></textarea>
		</template>
		<div v-else class="parallel">
			<!-- Parallel corpus -->
			<label class="control-label" for="sourceVersion">{{$t('search.parallel.queryForSourceVersion')}}
				<SelectPicker id="sourceVersion" :options="parallelSourceVersionOptions"
					v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
			</label>
			<textarea class="form-control querybox" name="querybox" rows="7" v-model="mainQuery"></textarea>

			<div v-for="(version, index) in parallelTargetVersions" :key="version">
				<label class="control-label">{{$t('search.parallel.queryForTargetVersion')}}
					<span @click="removeTargetVersion(version)" class="targetVersion" :title="$t('widgets.clickToRemove').toString()" href="#">
						{{versionDisplayName(version)}}
					</span>
				</label>
				<textarea class="form-control querybox" rows="7"
					:value="targetQueries[index]"
					@input="changeTargetQuery(index, $event)"></textarea>
			</div>

			<label class="control-label">
				{{ parallelTargetVersions && parallelTargetVersions.length > 0 ?
				$t('search.parallel.addTargetVersion') :
				$t('search.parallel.chooseTargetVersion')
				}}</label>
			<div>
				<SelectPicker :options="parallelTargetVersionOptions" @input="addTargetVersion($event)" />
			</div>

			<label class="control-label">{{ $t('search.parallel.alignBy') }}</label>
			<div>
				<div class="btn-group">
					<AlignBy />
				</div>
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
import AlignBy from '@/pages/search/form/AlignBy.vue';
import { annotatedFieldDisplayName, annotatedFieldOption } from '@/utils/i18n';
import { getParallelFieldName } from '@/utils/blacklabutils';

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
		parallelSourceVersionOptions() {
			const prefix = CorpusStore.get.parallelFieldPrefix();
			return PatternStore.get.parallelSourceVersionOptions().map(o => annotatedFieldOption(this.$i18n, prefix, o));
		},

		// If this is a parallel corpus: the available target version options (all except chosen sources and targets)
		parallelTargetVersionOptions() {
			const prefix = CorpusStore.get.parallelFieldPrefix();
			return PatternStore.get.parallelTargetVersionOptions()
				.filter(v => !this.parallelTargetVersions.includes(v.value))
				.map(o => annotatedFieldOption(this.$i18n, prefix, o));
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
			get() {
				return PatternStore.getState().expert.query;
			},
			set: PatternStore.actions.expert.query,
		},

		// If this is a parallel corpus: the target queries
		targetQueries: {
			get() {
				return PatternStore.getState().expert.targetQueries;
			},
			set: PatternStore.actions.expert.targetQueries,
		},

	},
	methods: {
		changeTargetQuery(index: number, event: InputEvent): void {
			const textarea = event.target as HTMLTextAreaElement;
			PatternStore.actions.expert.changeTargetQuery({index, value: textarea.value});
		},
		addTargetVersion(version: string): void {
			if (version != null) // can happen when select is reset to empty option
				PatternStore.actions.parallelVersions.addTarget(version);
		},
		removeTargetVersion: PatternStore.actions.parallelVersions.removeTarget,
		versionDisplayName: function (version: string): string {
			const opt = CorpusStore.get.parallelVersionOptions().find(v => v.value === version);
			const prefix = CorpusStore.get.parallelFieldPrefix();
			if (opt)
				return annotatedFieldDisplayName(this.$i18n, getParallelFieldName(prefix, opt.value), opt.label);
			return version;
		},
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

.querybox {
	width: 100%;
	resize: none;
	margin-bottom: 10px;
}

.parallel {
	margin: 15px 0;

	label {
		margin-top: 10px;
	}
	textarea, .querybox {
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