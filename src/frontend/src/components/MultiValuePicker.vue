<template>
	<div class="multi-value-picker">
		<div class="selected">
			<!-- <p v-if="selected.length > 0">{{ textSelected || $t('widget.multiValuePicker.textSelected') }}:</p> -->
			<ul>
				<li class='option' v-for="v in selected" :key="v.value" :data-value="v.value" title="Click to remove" @click="clickLabel($event?.target)">
					{{ v.label || v.value }}
				</li>
				<li v-if="optionsNotYetSelected.length > 0">
					<SelectPicker :options="optionsNotYetSelected" :value="selectValue" @input="add($event)" data-menu-width="grow" hideEmpty/>
				</li>
			</ul>
			<!-- <p v-if="selected.length === 0">{{ textNoneSelected || $t('widget.multiValuePicker.textNoneSelected') }}</p> -->
		</div>
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
		options: {
			type: Array as () => Option[],
			default: () => [] as Option[]
		},
		value: Array as () => string[]|null,
		textNoneSelected: {
			type: String,
			default: ''
		},
		textSelected: {
			type: String,
			default: ''
		},
	},
	computed: {
		optionsNotYetSelected(): Option[] {
			return this.options.filter(o => !this.selected.includes(o));
		},
	},
	methods: {
		add(v: string) {
			const opt = this.options.find(o => (o as Option).value === v);
			if (opt) {
				const i = this.selected.indexOf(opt);
				if (i < 0) {
					// Not yet selected: add it at the end
					this.selected.push(opt);
				}
			}

			// Clear SelectPicker selection (kinda ugly...)
			// this.selectValue = v;
			// setTimeout(() => {
			// 	this.selectValue = null;
			// }, 10);
		},
		clickLabel(target: EventTarget|null) {
			if (target && target instanceof HTMLElement) {
				const v = target.getAttribute('data-value') || target.innerText;
				this.remove(v);
			}
		},
		remove(v: string) {
			const opt = this.options.find(o => (o as Option).value === v);
			if (opt) {
				const i = this.selected.indexOf(opt);
				if (i >= 0) {
					this.selected.splice(i, 1);
				}
			}
		},
	},
	data: () =>  ({
		selected: [] as Option[],
		selectValue: null as string|null,
	}),
	watch: {
		selected() {
			//console.log('selected:', this.selected);
			this.$emit('input', this.selected.map(o => o.value));
		},
	},
	mounted() {
	},
	beforeDestroy() {
	},
});
</script>

<style lang="scss" scoped>

div.selected {

	margin-top: 0.5rem;

	ul {
		display: inline;
		padding: 0;
		li {
			list-style-type: none;
			display: inline-block;
			margin: 2px;
			user-select: none;
		}
		li.option {
			position: relative;
			top: 1px;
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
}

</style>