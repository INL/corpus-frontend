<template>
	<!-- Is this a parallel corpus? -->
	<div v-if="mode === 'simple'">
		<label class="control-label">{{ $t('search.inSourceVersion') }}</label>
		<div>
			<SelectPicker :options="parallelSourceVersionOptions"
					v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
		</div>

		<label class="control-label">{{ $t('search.andCompareWithTargetVersions') }}</label>
		<div>
			<MultiValuePicker :options="parallelTargetVersionOptions" v-model="parallelTargetVersions" />
		</div>
	</div>
	<div v-else>
		<div class="form-group">
			<label class="col-xs-12 col-md-3">{{ $t('search.inSourceVersion') }}</label>
			<div class="col-xs-12 col-md-9">
				<SelectPicker :options="parallelSourceVersionOptions"
						v-model="parallelSourceVersion" data-menu-width="grow" hideEmpty/>
			</div>
		</div>
		<div class="form-group">
			<label class="col-xs-12 col-md-3">{{ $t('search.andCompareWithTargetVersions') }}</label>
			<div class="col-xs-12 col-md-9">
				<MultiValuePicker :options="parallelTargetVersionOptions" v-model="parallelTargetVersions" />
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
		mode: {
			type: String,
			default: 'simple'
		}
	},
	data: () => ({
	}),
	computed: {
		// What parallel versions are there (e.g. "en", "nl", etc.)
		parallelVersionOptions: function (): Option[] {
			return CorpusStore.get.parallelVersions()
				.map(value => ({
					value: value.name,
					label: value.displayName || value.name
				}));
		},
		// What parallel versions should be shown as source options?
		// (all except already chosen target ones)
		parallelSourceVersionOptions: function (): Option[] {
			const targets = PatternStore.get.parallelVersions().targets;
			return this.parallelVersionOptions.filter(value => !targets.includes(value.value));
		},
		// What parallel versions should be shown as target options?
		// (all except already chosen source and target ones)
		parallelTargetVersionOptions: function (): Option[] {
			const src = PatternStore.get.parallelVersions().source || '';
			return this.parallelVersionOptions.filter(value => value.value !== src);
		},
		parallelSourceVersion: {
			get(): string|null { return PatternStore.get.parallelVersions().source; },
			set: PatternStore.actions.parallelVersions.parallelSourceVersion
		},
		parallelTargetVersions: {
			get(): string[]|null { return PatternStore.get.parallelVersions().targets; },
			set: PatternStore.actions.parallelVersions.parallelTargetVersions
		},

	},
});
</script>

<style lang="scss" scoped>

label { font-weight: bold; }

</style>