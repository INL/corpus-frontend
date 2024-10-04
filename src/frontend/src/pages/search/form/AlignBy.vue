<template>
	<div class="form-">
		<label class="control-label">{{ $t('search.parallel.alignBy') }}</label>
		<div>
			<div class="btn-group">
				<button v-for="option in alignByOptions"
					type="button"
					:class="['btn', alignBy === option.value ? 'active btn-primary' : 'btn-default']"
					:key="option.value"
					:value="option.value"
					:title="option.title || undefined"
					@click="alignBy = option.value">{{option.label || option.value || 'document'}}</button> <!-- empty value searches across entire documents -->
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as PatternStore from '@/store/search/form/patterns';
import * as UIStore from '@/store/search/ui';
import { Option } from '@/components/SelectPicker.vue';

export default Vue.extend({
	data: () => ({
	}),
	computed: {
		alignByOptions(): Option[] {
			return UIStore.getState().search.shared.alignBy.elements?.map(e => ({
				...e,
				label: this.$tAlignByDisplayName(e),
			}));
		},
		alignBy: {
			get(): string { return PatternStore.get.parallelAnnotatedFields().alignBy || UIStore.getState().search.shared.alignBy.defaultValue; },
			set(value: string) {
				PatternStore.actions.parallelFields.alignBy(value === '' ? null : value);
			},
		}
	},
});
</script>

<style lang="scss" scoped>
</style>