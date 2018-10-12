<template>
<select v-model="currentValue" class="selectpicker" ref="select">
	<template v-for="(optOrGroup, index) in options">
		<optgroup v-if="optOrGroup.options" :key="index" :label="optOrGroup.label">
			<option v-for="option in optOrGroup.options" :key="option.value" :value="option.value" :data-content="option.label" :selected="isSelected(option.value)"/>
		</optgroup>
		<option v-else :key="optOrGroup.value" :value="optOrGroup.value" :data-content="optOrGroup.label" :selected="isSelected(optOrGroup.value)"/>
	</template>
</select>

</template>

<script lang="ts">
import Vue from 'vue';

import $ from 'jquery';

export type OptGroup = {
	label: string;
	options: Option[];
};

export type Option = {
	/** May contain html */
	label: string;
	value: string;
}

export default Vue.extend({
	props: {
		options: {
			type: Array as () => Array<OptGroup|Option>,
			required: true
		},
		value: {
			default: null,
			validator(value: null|string|string[]) {
				return value == null || Array.isArray(value) && value.every(v => typeof v === 'string') || typeof value === 'string'
			},
		},
	},
	data: () => ({
		currentValue: null as null|string|string[], // synced with select
	}),
	watch: {
		value: {
			immediate: true,
			handler(newVal) {
				if (newVal !== this.currentValue) {
					this.currentValue = newVal;
					$(this.$refs.select).selectpicker('val', newVal);
				}
			}
		},
		// TODO only fire when closing the menu
		currentValue(newValue) {
			this.$emit('input', newValue);
		}
	},
	methods: {
		isSelected(value: string) {
			return this.value != null && this.value === value || (this.value as string[]).includes(value);
		}
	}
});

</script>

<style>
</style>