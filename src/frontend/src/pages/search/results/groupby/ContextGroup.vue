<template>
	<div class="groupby-editor">

		<SelectPicker
			class="groupby-editor-annotation"
			data-class="btn-default btn-sm"
			data-width="auto"

			container="body"

			hideEmpty

			:searchable="annotationOptions.length > 12"
			:options="annotationOptions"

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

				v-model="range"

				ref="slider"
			>
				<div class="groupby-editor-slider-handle" slot="dot" slot-scope="{value}">{{value}}</div>
			</Slider>
		</div>

		<div class="groupby-editor-checkboxes">
			<div class="groupby-editor-case-sensitive checkbox" title="Treat context case-sensitive">
				<label><input type="checkbox" v-model="caseSensitive"> Case-sensitive</label>
			</div>
			<div :class="['groupby-editor-end-of-hit', 'checkbox', {'disabled': context !== 'hit'}]" :title="context !== 'hit' ? 'Only available for hit context' : 'Group the last words in the hit instead of the first'">
				<label><input type="checkbox" :disabled="context !== 'hit'" v-model="fromEndOfHit"> From end of hit </label>
			</div>
		</div>

		<button
			class="groupby-editor-delete btn btn-default btn-sm"
			title="Remove group criteria"

			@click="$emit('delete')"
		>
			<span class="fa fa-times fa-lg text-danger"></span>
		</button>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

// @ts-ignore
import Slider from 'vue-slider-component';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';

import SelectPicker, {Option} from '@/components/SelectPicker.vue';

export default Vue.extend({
	components: {
		SelectPicker,
		Slider
	},
	props: {
		value: { required: true, type: String as () => string },
		// should probably be equal to wordsAroundHit setting (the context size)
		// but may cause issues when deserializing old query with different wordsaroundhit?
		// max: { default: 5, type: Number as () => number },
		// annotations: { required: true, type: Array as () => Option[] },
		// defaultAnnotation: { required: true, type: String as () => string }
	},
	data: () => ({
		max: 5, // max slider value, should probably be equal to wordsAroundHit...

		caseSensitive: false,
		context: 'hit' as 'before'|'hit'|'after',
		fromEndOfHit: false,
		annotation: '',
		range: [0, 5],
	}),
	computed: {
		defaultAnnotation(): string {
			const mainAnnotationId = CorpusStore.get.firstMainAnnotation().id;
			const options = UIStore.getState().results.shared.groupAnnotationIds;
			return options.includes(mainAnnotationId) ? mainAnnotationId : options[0] || '';
		},
		annotationOptions(): Option[] {
			const allAnnotationsMap = CorpusStore.get.allAnnotationsMap();
			// Grouping on annotations without forward index is not supported by blacklab
			return UIStore.getState().results.shared.groupAnnotationIds
				.map(id => allAnnotationsMap[id][0])
				.map(a => ({label: a.displayName, value: a.id}));
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
		},

		contextGroupString(): string {
			// See http://inl.github.io/BlackLab/blacklab-server-overview.html#sorting-grouping-filtering-faceting
			let contextLetter: string;
			switch (this.context) {
				case 'before': contextLetter = 'L'; break; // Left
				case 'hit': contextLetter = (!this.fromEndOfHit ? 'H' : 'E'); break; // Hit, End, respectively
				case 'after': contextLetter = 'R'; break; // Right
			}

			return `context:${this.annotation}:${this.caseSensitive ? 's' : 'i'}:${contextLetter!}${this.range[0]}-${this.range[1]}`;
		}
	},
	methods: {
		resetToDefaults() {
			this.caseSensitive = false;
			this.context = 'hit';
			this.fromEndOfHit = false;
			this.annotation = this.defaultAnnotation;
			this.range = [1, this.max];
		},
		isValidAnnotation(annotation: string) {
			return CorpusStore.get.annotationDisplayNames()[annotation] != null;
		}
	},
	watch: {
		contextGroupString(s) {
			this.$emit('input', s);
		},
		value: {
			immediate: true,
			handler(v) {
				// See http://inl.github.io/BlackLab/blacklab-server-overview.html#sorting-grouping-filtering-faceting
				const patt = /context:(\w+):(s|i):(L|R|H|E)(\d+)\-(\d+)/;

				const match = v.match(patt);
				if (match == null) {
					this.resetToDefaults();
					return;
				}

				const contextLetter = match[3] as 'L'|'R'|'H'|'E';

				this.annotation = this.isValidAnnotation(match[1]) ? match[1] : this.defaultAnnotation;
				this.caseSensitive = match[2] === 's';
				this.range = [Number.parseInt(match[4], 10), Number.parseInt(match[5], 10)];
				this.fromEndOfHit = (contextLetter === 'E');

				switch (contextLetter) {
					case 'L': this.context = 'before'; break;
					case 'R': this.context = 'after'; break;
					case 'H':
					case 'E': this.context = 'hit'; break;
					default: throw new Error('wat');
				}
			}
		}
	},
	mounted() {
		// This is required because the slider component is shuffled around a little after rendering
		// and throws off the click handling of the slider handles (an ofset is introduced)
		requestAnimationFrame(() => (this.$refs.slider as any).refresh());
	}
});
</script>

<style lang="scss">

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

$bg-primary: #337ab7;
$bg-primary-hover: #286090;
$bg-primary-active: #204d74;

$br-primary: #2e6da4;
$br-primary-hover:#204d74;
$br-primary-active: #122b40;

.groupby-editor-slider {
	height: 30px;

	> .vue-slider {
		top: 50%;
		transform: translateY(-50%);
		cursor: pointer;

		background: #ccc;
		&:hover,
		&:focus {
			background: #bbb;
		}
		&:active {
			background: #aaa;
		}

		.vue-slider-process {
			background: $bg-primary;

			&:hover,
			&:focus {
				background: $bg-primary-hover;
			}
			&:active {
				background: $bg-primary-active;
			}
		}
	}
}
.groupby-editor-slider-handle {
	width: calc(100% + 1px);
	height: calc(100% + 1px);
	line-height: 120%;

	border-radius: 100%;
	text-align: center;
	border: 1px solid;
	box-shadow: inset 0px 0px 0px 1px white;
	color: white;
	box-sizing: content-box;
	margin-top: -1px;

	background-color: $bg-primary;
	border-color: $br-primary;

	&:hover,
	&:focus {
		background-color: $bg-primary-hover;
		border-color: $br-primary-hover;
	}
	&:active {
		background-color: $bg-primary-active;
		border-color: $br-primary-active;
	}

}

.groupby-editor-end-of-hit ,
.groupby-editor-case-sensitive {
	margin: 0!important;
	padding: 5px;
}

</style>