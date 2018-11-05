<template>
<select v-model="currentValue" class="selectpicker" ref="select">
	<template v-for="(optOrGroup, index) in options">
		<optgroup v-if="optOrGroup.options" :key="index" :label="optOrGroup.label">
			<option v-for="option in optOrGroup.options"
				:key="option.value"
				:value="option.value"
				:data-content="(escapeLabels || !option.label) ? undefined : option.label"
				:selected="isSelected(option.value)"
			><template v-if="escapeLabels || !option.label">{{option.label || option.value}}</template></option>
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
	value: string;
	/** May contain html if escapeLabels is false, in case label is undefined, value used a label, but is html-escaped. */
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
	data: () => ({
		currentValue: null as null|string|string[], // synced with select
		destroying: false, // selectpicker rerenders after teardown leaving zombie elements..
	}),
	watch: {
		value: {
			immediate: true,
			handler(newVal: null|undefined|string|string[]) {
				$(this.$el).selectpicker('val', newVal!);
			}
		},
		// TODO only fire when closing the menu
		currentValue(newValue) {
			if (
				newValue == this.value || // null, undefined, string
				(Array.isArray(newValue) && Array.isArray(this.value) && newValue.length === this.value.length && newValue.every(v => (this.value as string[]).includes(v)))
			) {
				return;
			}
			this.$emit('input', newValue);
		},
		options() {
			Vue.nextTick(() => $(this.$el).selectpicker('refresh'));
		},
	},
	methods: {
		isSelected(value: string) {
			return this.value === value || (Array.isArray(this.value) && this.value.includes(value));
		}
	},
	created() {
		if (this.$attrs.multiple != null) {
			this.currentValue = Array.isArray(this.value) ? this.value : [];
		}
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