<template>
	<div>
		<h3>{{$t('search.expert.corpusQueryLanguage') + (isParallelCorpus ? '' : ':') }}
			<a class='help' target='_blank' href='https://inl.github.io/BlackLab/guide/corpus-query-language.html'
				:title="$t('widgets.learnMore').toString()">🛈</a>
		</h3>
		<template v-if="!isParallelCorpus">
			<!-- Regular case -->
			<textarea id="querybox" class="form-control" name="querybox" rows="7" v-model.lazy="expert"></textarea>
		</template>
		<div v-else class="parallel">
			<!-- Parallel corpus -->
			<label class="control-label" for="sourceVersion">{{$t('search.parallel.sourceVersion')}}
				<SelectPicker id="sourceVersion" :options="parallelSourceVersionOptions"
					v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
			</label>
			<textarea id="querybox" class="form-control" name="querybox" rows="7" v-model.lazy="expert"></textarea>

			<div v-for="(version, index) in parallelTargetVersions" :key="version">
				<label class="control-label">{{$t('search.parallel.targetVersion')}}
					<span @click="removeTargetVersion(version)" class="targetVersion" :title="$t('widgets.clickToRemove').toString()" href="#">
						{{versionDisplayName(version)}}
					</span>
				</label>
				<textarea :id="`querybox-${version}`" class="form-control" rows="7"
					v-model="expertTargetQueries[index]"></textarea>
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

export default Vue.extend({
	components: {
		SelectPicker,
		MultiValuePicker
	},
	props: {
		isParallelCorpus: {
			type: Boolean,
			default: false
		}
	},
	data: () => ({
	}),
	computed: {
		// Is this a parallel corpus?
		isParallelCorpus: CorpusStore.get.isParallelCorpus,

		// What parallel versions should be shown as source options?
		// (all except already chosen target ones)
		parallelSourceVersionOptions: function (): Option[] {
			return PatternStore.get.parallelSourceVersionOptions();
		},
		// What parallel versions should be shown as target options?
		// (all except already chosen source and target ones)
		parallelTargetVersionOptions: function (): Option[] {
			return PatternStore.get.parallelTargetVersionOptions();
		},
		parallelSourceVersion: {
			get(): string|null { return PatternStore.get.parallelVersions().source; },
			set: PatternStore.actions.parallelVersions.parallelSourceVersion
		},
		parallelTargetVersions: {
			get(): string[]|null { return PatternStore.get.parallelVersions().targets; },
			set: PatternStore.actions.parallelVersions.parallelTargetVersions
		},

		expert: {
			get(): string|null { return PatternStore.getState().expert.query; },
			set: PatternStore.actions.expert.query,
		},
		expertTargetQueries: {
			get(): string[] { return PatternStore.getState().expert.targetQueries; },
			set: PatternStore.actions.expert.targetQueries,
		},

	},
	methods: {
		addTargetVersion(version: string) {
			if (version == null) {
				console.warn('tried to add null target version');
				return;
			}
			const targets = this.parallelTargetVersions?.concat([version]) || [version];
			PatternStore.actions.parallelVersions.parallelTargetVersions(targets);
		},
		removeTargetVersion(version: string) {
			const targets = this.parallelTargetVersions?.filter(v => v !== version) || [];
			PatternStore.actions.parallelVersions.parallelTargetVersions(targets);
		},
		versionDisplayName(version: string) {
			const option = PatternStore.get.parallelVersionOptions().find(o => o.value === version);
			return option?.label || version;
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