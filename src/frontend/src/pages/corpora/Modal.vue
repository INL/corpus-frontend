<template>
	<div :class="classes" tabindex="-1" role="dialog">
		<div class="modal-dialog" :style="{height, width}">
			<div class="modal-content">
				<div class="modal-header">
					<button v-if="close" type="button" :disabled="!closeEnabled" class="close" aria-hidden="true" @click="$emit('close')">×</button>
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
})
</script>

<style lang="scss" scoped>
.modal { // wrapper
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 30px;
	@media (max-width: 767px) { padding: 17px; }
	&.large {
		padding: 17px;
		@media (max-width: 767px) { padding: 0; }

		.modal-dialog {
			width: auto;
			height: auto;
		}
	}

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



}


</style>
