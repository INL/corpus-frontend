<template>
	<div class="multi-value-picker">
		<SelectPicker :options="options" :value="selectValue" @input="add($event)" data-menu-width="grow" hideEmpty/>
		<ul v-if="selected.length > 0">
			<li v-for="v in selected" :key="v">{{ v }}</li>
		</ul>
		<p v-else>Select one or more version(s)</p>
	</div>
</template>

<script lang="ts">

// tslint:disable

import Vue from 'vue';
import SelectPicker from '@/components/SelectPicker.vue';

export type SimpleOption = string;

export type Option = {
	value: string;
	label?: string;
	title?: string|null;
	disabled?: boolean;
};
export type OptGroup = {
	label?: string;
	title?: string|null;
	disabled?: boolean;
	options: Array<string|Option>;
};

export type Options = Array<SimpleOption|Option|OptGroup>;

export default Vue.extend({
	components:	{
		SelectPicker,
	},
	props: {
		options: { type: Array as () => Option[], default: () => [] as Options },
		value: Array as () => string[]|null,
	},
	methods: {
		add(v: string) {
			this.selected.push(v);
			this.$emit('input', this.selected);
			console.log(this.selected);
			this.selectValue = null; // TODO: clear selection?
		},
	},
	data: () =>  ({
		selected: [] as string[],
		selectValue: null as string|null,
	}),
	watch: {
	},
	mounted() {
	},
	beforeDestroy() {
	},
});
</script>

<style lang="scss">

ul {
	padding: 0;
	li {
		list-style-type: none;
		display: inline-block;
		background-color: lightblue;
		padding: 5px;
		border-radius: 3px;
		margin: 2px;
	}
}

</style>