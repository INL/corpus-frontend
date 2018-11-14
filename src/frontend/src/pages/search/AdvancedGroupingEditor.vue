<template>
	<div class="groupby-editor">

		<SelectPicker
			class="groupby-editor-annotation"
			data-style="btn-default btn-sm"
			data-width="auto"

			:data-live-search="availableAnnotations.length > 10"
			:options="availableAnnotations"

			v-model="annotation"
		/>

		<div class="groupby-editor-context-container">
			<div class="groupby-editor-context btn-group">
				<button v-for="option in contextOptions"
					type="button"

					:class="[
						'groupby-editor-context-option',
						'btn',
						'btn-default',
						'btn-sm',
						{
							'active': context === option.value
						}
					]"
					:key="option.value"
					:value="option.value"
					@click="context = option.value"
				>{{option.label}}</button>
			</div>
			<Slider
				class="groupby-editor-slider"

				:tooltip="'never'"
				:tooltip-dir="'bottom'"
				:speed="0"
				:min="1"
				:max="max"
				:width="/*'100px'*/'auto'"
				:reverse="sliderInverted"

				v-model="rangeValue"

				ref="slider"
			>
				<div class="groupby-editor-slider-handle" slot="dot" slot-scope="{value}">{{value}}</div>
			</Slider>
		</div>

		<div class="groupby-editor-checkboxes">
			<div class="groupby-editor-case-sensitive checkbox">
				<label><input type="checkbox" v-model="caseSensitive"> Case sensitive</label>
			</div>
			<div :class="['groupby-editor-end-of-hit', 'checkbox', {'disabled': context !== 'hit'}]" :title="context !== 'hit' ? 'Only available for hit context' : undefined">
				<label><input type="checkbox" :disabled="context !== 'hit'" v-model="fromEndOfHit"> From end of hit </label>
			</div>
		</div>

		<button
			class="groupby-editor-delete btn btn-default btn-sm"
			title="Delete group criteria"

			@click="$emit('delete')"
		>
			<span class="fa fa-times fa-lg text-danger"></span>
		</button>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

//@ts-ignore
import Slider from 'vue-slider-component';

import * as CorpusStore from '@/store/corpus';

import SelectPicker, {Option} from '@/components/SelectPicker.vue';

import {getSetPairsFromKeys} from '@/utils';

export type AdvancedGroupSettings = {
	caseSensitive: boolean;
	context: 'before'|'hit'|'after';
	fromEndOfHit: boolean;
	annotation: string;
	start: number;
	end: number;
};

export default Vue.extend({
	components: {
		SelectPicker,
		Slider
	},
	props: {
		value: {
			type: Object as () => AdvancedGroupSettings,
			required: true
		},
		max: {
			// should probably be equal to wordsAroundHit setting (the context size)
			// but may cause issues when deserializing old query with different wordsaroundhit?
			type: Number as () => number,
			default: 5,
		}
	},
	data: () => ({
		rangeValue: [] as number[]
	}),
	computed: {
		...getSetPairsFromKeys<AdvancedGroupSettings>([
			'caseSensitive',
			'context',
			'fromEndOfHit',
			'annotation',
			'start',
			'end'
		]),
		availableAnnotations(): Option[] {
			return CorpusStore.get.annotations().map(annot => ({
				label: annot.displayName,
				value: annot.id
			}));
		},
		contextOptions(): Option[] {
			return [{
				label: 'Before',
				value: 'before'
			}, {
				label: 'Hit',
				value: 'hit'
			}, {
				label: 'After',
				value: 'after'
			}];
		},
		sliderInverted(): boolean {
			return this.context === 'before' || (this.context === 'hit' && this.fromEndOfHit);
		}
	},
	watch: {
		sliderInverted() {
			Vue.nextTick(() => (this.$refs.slider as any).refresh());
		},
		rangeValue([low, high]: [number, number]) {
			this.start = low;
			this.end = high;
		},
		value(newValue: AdvancedGroupSettings) {
			this.rangeValue = [newValue.start, newValue.end];
		}
	},
	created() {
		this.rangeValue = [this.start, this.end];
	},
	mounted() {
		// slider initializes before all sibling components have the correct size
		// causing clicks on it to have an offset relative to the actual position :(
		// unless we do this.
		// Vue.nextTick is not late enough unfortunately
		const self = this;
		setTimeout(() => (self.$refs.slider as any).refresh(), 100);
	}
})
</script>

<style lang="scss">

$classes: 'annotation' 'context-container' 'slider' 'context' 'delete';

.groupby-editor {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	border: 1px solid #ccc;
	padding: 5px;
	margin-bottom: 5px;
	border-radius: 4px;

	&+& {
		margin-top: 10px;
	}

	&:not(:hover) > .groupby-editor-delete {
		opacity: 0;
	}

	> *[class^="groupby-editor"],
	> *[class*=" groupby-editor"] {
		flex: none;

		&:not(:last-child) {
			margin-right: 5px;
		}
	}
}

.groupby-editor-delete {
	background: none!important;
	border: none!important;
	align-self: center;
	opacity: 0.5;
	&:hover {
		opacity: 1;
	}
	margin-left: auto;
}

.groupby-editor-slider {
	height: 30px;
	> .vue-slider {
		top: 50%;
		transform: translateY(-50%);
	}
}
.groupby-editor-slider-handle {
	width: calc(100% + 1px);
	height: calc(100% + 1px);
	line-height: 120%;
	background: #3498db;
	border-radius: 100%;
	text-align: center;
	border: 1px solid #2f96da;
	box-shadow: inset 0px 0px 0px 1px white;
	color: white;
	box-sizing: content-box;
	margin-top: -1px;
}

.groupby-editor-end-of-hit ,
.groupby-editor-case-sensitive {
	margin: 0!important;
	padding: 5px;
}

</style>