<template>
	<div class="tabs" :class="{ vertical }" :style="style">
		<div v-for="tab, i in tabsModel" :class="{
			active: tab.value === modelValue,
			tab,
			disabled: tab.disabled
		}">
			<slot name="default" :tab="tab" :i="i">
				<slot name="before" :tab="tab" :i="i"></slot>
				<button
					type="button"
					:class="{
						'tab-content': true,
						disabled: tab.disabled
					}"
					:title="tab.title || ''"
					:disabled="tab.disabled"
					@click="modelValue = tab.value"
				>
					{{ tab.label }}
				</button>
				<slot name="after" :tab="tab" :i="i"></slot>
			</slot>
		</div>
	</div>
</template>

<script lang="ts">
import { Option } from '@/types/apptypes';
import Vue from 'vue';

export default Vue.extend({
	props: {
		value: String,
		tabs: Array as () => Option[]|string[],
		vertical: Boolean,
		inactiveColor: {default: '#f5f5f5'},
		activeColor: {default: 'white'},
		backgroundColor: {default: '#ddd'},
		disableColor: {default: 'eee'},
		activeBorderColor: {default: '#ddd'},
	},
	data: () => ({
		internalModel: '',
	}),
	computed: {
		style(): any {
			return {
				'--inactiveColor': this.inactiveColor,
				'--activeColor': this.activeColor,
				'--backgroundColor': this.backgroundColor,
				'--disableColor': this.disableColor,
				'--activeBorderColor': this.activeBorderColor,
			}
		},
		tabsModel(): Option[] {
			return this.tabs.map((tab: Option|string) => {
				if (typeof tab === 'string') {
					return { label: tab, value: tab };
				}
				return tab;
			});
		},
		modelValue: {
			get(): string {
				return this.value || this.internalModel;
			},
			set(value: string) {
				this.$emit('input', value);
				this.internalModel = value;
			}
		}
	}
})

</script>

<style lang="scss" scoped>

@mixin roundover-blocks($zindex, $color, $size, $radius) {
	&:before, &:after {
		content: ' ';
		position: absolute;
		width: $size;
		height: $size;
		background: $color;
		z-index: $zindex;
		border-radius: $radius;
	}

	@at-root .tabs:not(.vertical) &:before {
		bottom: 0;
		left: -$size;
	}

	@at-root .tabs:not(.vertical) &:after {
		bottom: 0;
		right: -$size;
	}

	@at-root .tabs.vertical &:before {
		right: 0;
		top: -$size;
	}

	@at-root .tabs.vertical &:after {
		right: 0;
		bottom: -$size;
	}
}

@mixin block($beforeAfter, $size, $color, $zindex) {
	&:#{$beforeAfter} {
		content: ' ';
		position: absolute;
		width: $size;
		height: $size;
		background: $color;
		z-index: $zindex;
		@content;
	}
}

@mixin roundoverHorizontal($size, $active, $inactive) {
	&:not(:first-child) {
		@include block('before', $size, $inactive, 3) {bottom: -1px; left: -$size; border-bottom-right-radius: 100%; border-top-left-radius: 100%; border-right: 1px solid var(--activeBorderColor); border-bottom: 1px solid var(--activeBorderColor);}
		> *:first-child {
			@include block('before', $size, $active, 2) {bottom: -1px; left: -$size; border-top-left-radius: 100%;}
		}
	}
	&:not(:last-child) {
		@include block('after',  $size, $inactive, 3) {bottom: -1px; right: -$size; border-bottom-left-radius: 100%; border-top-right-radius: 100%; border-left: 1px solid var(--activeBorderColor); border-bottom: 1px solid var(--activeBorderColor);}
		> *:first-child {
			@include block('after',  $size, $active, 2) {bottom: -1px; right: -$size; border-top-right-radius: 100%;}
		}
	}
}

@mixin roundoverVertical($size, $active, $inactive) {
	&:not(:first-child) {
		// pill in front
		@include block('before', $size, $inactive, 3) {right: -1px; top: -$size; border-bottom-right-radius: 100%; border-top-left-radius: 100%; border-right: 1px solid var(--activeBorderColor); border-bottom: 1px solid var(--activeBorderColor);}
		// square in back
		> *:first-child {
			@include block('before', $size, $active, 2) {right: -1px; top: -$size; border-top-left-radius: 100%}
		}
	}
	&:not(:last-child) {
		@include block('after',  $size, $inactive, 3) {right: -1px; bottom: -$size; border-bottom-left-radius: 100%; border-top-right-radius: 100%; border-right: 1px solid var(--activeBorderColor); border-top: 1px solid var(--activeBorderColor);}
		> *:first-child {
			@include block('after',  $size, $active, 2) {right: -1px; bottom: -$size; border-bottom-left-radius: 100%;}
		}
	}
}

.tabs {
	display: flex;
	background: var(--backgroundColor);
	border: 1px solid var(--activeBorderColor);

	.tab {
		background: var(--inactiveColor);
		padding: 5px 10px;
		border: 1px solid var(--inactiveColor);

		> .tab-content {
			padding: 0;
			background: none;
			border-radius: 0;
			border: none;
			margin: none;
			text-decoration: none;
		}

		&.active {
			background: var(--activeColor);
			border-color: var(--activeBorderColor);
			position: relative;
		}
	}

	&:not(.vertical) {
		border-bottom: 1px solid var(--activeBorderColor);

		> .tab {
			border-top-left-radius: 10px;
			border-top-right-radius: 10px;
			border-top: none;
			&:first-child { border-left: none; }
			&:last-child { border-right: none; }
		}
		> .tab.active {
			border-bottom: 1px solid var(--activeColor);
			margin-bottom: -1px;
			z-index: 2;
			@include roundoverHorizontal(10px, var(--activeColor), var(--inactiveColor));
		}
	}

	&.vertical {
		display: inline-flex;
		flex-direction: column;
		border-right: 1px solid var(--activeBorderColor);

		> .tab {
			border-top-left-radius: 10px;
			border-bottom-left-radius: 10px;
			border-left: none;
			&:first-child { border-top: none; }
			&:last-child { border-bottom: none; }
		}

		> .tab.active {
			border-right: 1px solid var(--activeColor);
			margin-right: -1px;
			z-index: 2;
			@include roundoverVertical(10px, var(--activeColor), var(--inactiveColor));
		}
	}
}


</style>