<template>
	<div class="fa fa-spinner fa-spin cf-spinner" :class="classes" :style="style">&ZeroWidthSpace;</div>
</template>

<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
	props: {
		lg: Boolean,
		xs: Boolean,
		sm: Boolean,
		inline: Boolean,
		overlay: Boolean,
		size: [Number, String]
	},
	data: () => ({ observer: null as ResizeObserver|null, }),
	computed: {
		classes(): any { return {lg: this.lg, sm: this.sm, overlay: this.overlay, inline: this.inline, xs: this.xs} },
		style(): any { return { fontSize: this.size ? (typeof this.size === 'number' || this.size.match(/^\d+$/)) ? this.size + 'px' : this.size : undefined,} }
	},
	mounted() {
		if (this.$el.classList.contains('overlay')) {
			const parent = this.$el.parentElement as HTMLElement;
			parent.style.position='relative';
			// size observer and center spinner
			this.observer = new ResizeObserver(() => {
				const {width, height} = parent.getBoundingClientRect();
				// don't use bounding client. It changes when the element rotates
				const ownWidth =  this.$el.scrollWidth;
				const ownHeight = this.$el.scrollHeight;
				const left = width / 2 - ownWidth / 2;
				const top = height / 2 - ownHeight / 2;
				// @ts-ignore
				this.$el.style.left = `${left}px`;
				// @ts-ignore
				this.$el.style.top = `${top}px`;
			});
			this.observer.observe(parent);

		}
	},
	beforeDestroy() { if (this.observer) this.observer.disconnect(); }
})
</script>

<style lang="scss" scoped>
.cf-spinner {
	color: white;
	background-color: black;
	opacity: 0.4;
	border-radius: 50%;
	padding: 0.2em;
	font-size: 80px;

	&.overlay {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
	}

	&.inline {
		display: inline-block;
		font-size: 1em;
	}
	&.xs {
		font-size: 20px;
		padding: 2px;
	}
	&.sm {
		font-size: 40px;
		padding: 5px;
	}
	&.lg {
		font-size: 120px;
		padding: 20px;
	}
}
</style>