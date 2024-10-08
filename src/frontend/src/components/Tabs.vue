<template>
	<div class="tabs" :class="{ vertical, flexy, wrap}">
		<div v-for="tab, index in tabsModel"
			:class="{
				active: index === modelValue.index,
				tab: true,
				disabled: tab.disabled,
				...(function() {
					if (typeof tab.class === 'string') return {[tab.class]: true}
					else return tab.class
				})()
			}"
			:style="tab.style"
			@click.middle="$emit('middlemouse', {tab, index})"
		>
			<slot name="default" :tab="tab" :i="index">
				<slot name="before" :tab="tab" :i="index"></slot>
				<button
					type="button"
					:class="{
						'tab-content': true,
						disabled: tab.disabled
					}"
					:title="tab.title || ''"
					:disabled="tab.disabled"
					@click="modelValue = {tab, index}"
				>
					{{ tab.label ?? tab.value }}
				</button>
				<slot name="after" :tab="tab" :i="index"></slot>
			</slot>
		</div>
	</div>
</template>

<script lang="ts">
import { Option } from '@/types/apptypes';
import Vue from 'vue';

export type Tab = Option&{
	class?: any,
	style?: CSSStyleDeclaration,
}

export default Vue.extend({
	props: {
		value: {required: false, type: [String, Number] },
		tabs: Array as () => Array<string|Option&{class?: string, style?: CSSStyleDeclaration}>,
		vertical: Boolean,
		flexy: Boolean,
		wrap: Boolean,
	},
	data: () => ({
		internalModel: -1,
	}),
	computed: {
		tabsModel(): Tab[] {
			return this.tabs.map((tab: Option|string) => {
				if (typeof tab === 'string') {
					return { label: tab, value: tab };
				}
				return tab;
			});
		},
		modelValue: {
			get(): {tab?: Tab, index: number} {
				if (typeof this.value === 'number') {
					return {tab: this.tabsModel[this.value], index: this.value};
				}
				if (typeof this.value === 'string') {
					const i = this.tabsModel.findIndex(tab => tab.value === this.value);
					return {tab: this.tabsModel[i], index: i};
				}
				else {
					return {tab: this.tabsModel[this.internalModel], index: this.internalModel};
				}
			},
			set(value: {tab: Tab, index: number}) {
				// emit either a number or a string, depending on what was put in.
				const emitValue = typeof this.value === 'string' ? value.tab.value : value.index;

				this.$emit('input', emitValue);
				this.internalModel = value.index;
			}
		}
	}
})

</script>

<style lang="scss" scoped>

.tabs {
	--inactiveColor: #f5f5f5;
	--activeColor: white;
	--backgroundColor: #ddd;
	--disableColor: #eee;
	--activeBorderColor: #ddd;
}

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


@mixin tab-border-active($position) {
	&:not(:first-child) {
		border-#{$position}: 1px solid var(--inactiveColor);
		&.active {
			border-#{$position}-color: var(--activeBorderColor);
		}
	}

	&.active+.tab {
		border-#{$position}-color: var(--activeBorderColor);
	}
}

$radius: 10px;

.tabs {
	display: flex;
	// overflow: auto;
	// overflow-y: hidden;
	background: var(--backgroundColor);

	&.wrap {
		flex-wrap: wrap;
	}

	.tab {
		background: var(--inactiveColor);
		padding: 5px 10px;
		display: flex;

		> .tab-content {
			padding: 0;
			background: none;
			border-radius: 0;
			border: none;
			margin: none;
			text-decoration: none;
			flex-grow: 1;
			white-space: nowrap;
		}

		&.active {
			background: var(--activeColor);
			border-color: var(--activeBorderColor);
			position: relative;
		}
	}

	&.flexy {
		flex-grow: 1;
		.tab {
			flex-grow: 1;
		}
	}

	&:not(.vertical) {
		border-bottom: 1px solid var(--activeBorderColor);

		> .tab {
			border-top-left-radius: $radius;
			border-top-right-radius: $radius;
			@include tab-border-active(left);
		}
		> .tab.active {
			border-bottom: 1px solid var(--activeColor);
			margin-bottom: -1px;
			z-index: 2;
			@include roundoverHorizontal($radius, var(--activeColor), var(--inactiveColor));
		}
	}

	&.vertical {
		display: inline-flex;
		flex-direction: column;
		border-right: 1px solid var(--activeBorderColor);

		> .tab {
			text-align: right;
			border-top-left-radius: $radius;
			border-bottom-left-radius: $radius;
			@include tab-border-active(top);
		}

		> .tab.active {
			border-right: 1px solid var(--activeColor);
			margin-right: -1px;
			z-index: 2;
			@include roundoverVertical($radius, var(--activeColor), var(--inactiveColor));
		}
	}
}


</style>