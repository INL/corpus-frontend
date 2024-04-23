<template>
	<div class="multi-value-picker">
		<SelectPicker :options="options" :value="selectValue" @input="add($event)" data-menu-width="grow" hideEmpty/>
		<div class="selected">
			<p v-if="selected.length > 0">
				{{ textSelected || $t('widget.multiValuePicker.textSelected') }}:
				<ul>
					<li v-for="v in selected" :key="v.value" :data-value="v.value" title="Click to remove" @click="clickLabel($event?.target)">
						{{ v.label || v.value }}
					</li>
				</ul>
			</p>
			<p v-else>{{ textNoneSelected || $t('widget.multiValuePicker.textNoneSelected') }}</p>
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
	methods: {
		add(v: string) {
			const opt = this.options.find(o => (o as Option).value === v);
			if (opt) {
				const i = this.selected.indexOf(opt);
				if (i >= 0) {
					// Already selected: unselect it
					this.selected.splice(i, 1);
				} else {
					// Not yet selected: add it at the end
					this.selected.push(opt);
				}
			}

			// Clear SelectPicker selection (kinda ugly...)
			this.selectValue = v;
			setTimeout(() => {
				this.selectValue = null;
			}, 10);
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
			console.log('selected:', this.selected);
			this.$emit('input', this.selected);
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
			background-color: lightblue;
			padding: 5px;
			border-radius: 3px;
			margin: 2px;
			cursor: pointer;
			&::after {
				font-weight: bold;
				content: '✖';
				margin-left: 5px;
			}
		}
	}
}

</style>