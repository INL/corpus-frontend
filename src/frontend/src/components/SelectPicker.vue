<template>
<select v-model="currentValue" class="selectpicker">
	<template v-for="(optOrGroup, index) in options">
		<optgroup v-if="optOrGroup.options" :key="index" :label="optOrGroup.label">
			<option v-for="option in optOrGroup.options"
				:key="option.value"
				:value="option.value"
				:data-content="(option.label && !escapeLabels) ? option.label : undefined"
			>{{option.label || option.value}}</option>
		</optgroup>
		<option v-else
			:key="optOrGroup.value"
			:value="optOrGroup.value"
			:data-content="(optOrGroup.label && !escapeLabels) ? optOrGroup.label : undefined"
		>{{optOrGroup.label || optOrGroup.value}}</option>
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
	value: string;
	/**
	 * May contain html if escapeLabels is false.
	 * Falls back to html-escaped value if omitted (regardless of escapeLabel - because values are likely not validated to be valid/trusted html).
	 */
	label?: string;
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
		escapeLabels: {
			default: true,
			type: Boolean as () => boolean
		},
	},
	computed: {
		currentValue: {
			get(): null|string|string[] {
				// Function only runs when this.value changes.
				// So we can use it to trigger a manual selectpicker update when our v-model changes
				$(this.$el).selectpicker('val', this.value!);
				return this.value;
			},
			set(newValue: string|string[]) {
				this.$emit('input', newValue);
			}
		}
	},
	watch: {
		options() {
			Vue.nextTick(() => $(this.$el).selectpicker('refresh'));
		},
	},
	mounted() {
		$(this.$el).selectpicker();
	},
	destroyed() {
		$(this.$el).selectpicker('destroy').remove();
	}
});

</script>

<style lang="scss">

/*
	Minor bootstrap-select overrides.
	Do not display the select all button,
	as it causes a massive query to be fired off when used on grouping.
	This can be removed if https://github.com/silviomoreto/bootstrap-select/issues/1614 is ever fixed
*/
.bs-select-all {
	display: none !important;
}

.bs-deselect-all {
	/* pretend we're the only button there */
	border-radius: 3px !important;
	width: 100% !important;
	font-weight: bold;
}

.bootstrap-select small.text-muted {
	padding-left: 0px !important;
}

</style>