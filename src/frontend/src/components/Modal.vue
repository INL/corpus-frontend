<template>
	<div :class="classes" tabindex="-1" role="dialog">
		<div class="modal-dialog" :style="{height, width}">
			<div class="modal-content">
				<div class="modal-header">
					<button v-if="close" type="button" :disabled="!closeEnabled" class="close" @click="$emit('close')">×</button>
					<slot name="title"><h4 class="modal-title">{{ title }}</h4></slot>
					<slot name="header"></slot>
				</div>
				<div class="modal-body">
					<slot name="body"></slot>
					<slot name="default"></slot>
				</div>
				<div class="modal-footer">
					<slot name="footer"></slot>
					<button v-if="close" type="button" class="btn" :class="closeClass" :disabled="!closeEnabled" @click="$emit('close')">{{ closeMessage }}</button>
					<button v-if="confirm" type="button" class="btn" :class="confirmClass" :disabled="!confirmEnabled" @click="$emit('confirm')">{{ confirmMessage }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
	props: {
		close: {default: true},
		closeEnabled: {default: true},
		closeMessage: {default: 'Close'},
		closeClass: {default: 'btn-default'},

		confirm: {default: true},
		confirmEnabled: {default: true},
		confirmMessage: {default: 'OK'},
		confirmClass: {default: 'btn-primary'},

		title: {default: 'Title'},
		large: Boolean,
		maxHeight: String,
		maxWidth: String,
		height: String,
		width: String,
	},
	computed: {
		classes(): Record<string, boolean> {
			return {
				'modal': true,
				'fade': true,
				'in': true,
				'large': this.large
			}
		}
	},
	created() {
		document.body.classList.add('modal-open');
		document.body.setAttribute('data-modal-count', (parseInt(document.body.getAttribute('data-modal-count') || '0') + 1).toString());
	},
	beforeDestroy() {
		document.body.setAttribute('data-modal-count', (parseInt(document.body.getAttribute('data-modal-count') || '0') - 1).toString());
		if (!document.body.hasAttribute('data-modal-count') || document.body.getAttribute('data-modal-count') === '0')
			document.body.classList.remove('modal-open');
	}
})
</script>

<style lang="scss" scoped>
// wrapper/backdrop. Should be fullscreen with some padding to prevent the modal itself from touching the screen edges.
.modal {
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;

	// normally quite a bit of padding.
	padding: 30px;
	// less padding on small screens
	@media (max-width: 767px) { padding: 17px; }


	.modal-dialog { // actual window
		display: inline-flex;
		max-width: 100%;
		max-height: 100%;
		margin: 0;

		> .modal-content {
			max-height: 100%;
			width: 100%;
			display: flex;
			flex-direction: column;

			> .modal-body {
				flex: 1;
				overflow-y: auto;
			}
		}
	}

	&.large {
		// Large modals have less padding
		padding: 17px;
		// And no padding on small screens
		@media (max-width: 767px) { padding: 0; }

		// We don't want the modal to be super large if it doesn't have to be.
		// Limit the size to the content.
		.modal-dialog {
			width: auto;
			min-width: 600px;
			height: auto;
		}
	}
}


</style>
