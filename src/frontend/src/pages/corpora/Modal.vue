<template>
	<div :class="classes" tabindex="-1" role="dialog" style="display: block; padding-right: 17px; opacity: 1;">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button v-if="showClose" type="button" :disabled="!canClose" class="close" aria-hidden="true" @click="$emit('close')">×</button>
					<slot name="title"><h4>{{ title }}</h4></slot>
					<slot name="header"></slot>
				</div>
				<div class="modal-body">
					<slot name="body"></slot>
				</div>
				<div class="modal-footer">
					<slot name="footer"></slot>
					<button v-if="showClose" type="button" class="btn btn-default" :disabled="!canClose" @click="$emit('close')">{{ closeMessage }}</button>
					<button v-if="showConfirm" type="button" class="btn btn-primary" :disabled="!canConfirm" @click="$emit('confirm')">{{ confirmMessage }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
	props: {
		showClose: { default: true, },
		canClose: { default: true, },
		showConfirm: {default: true},
		canConfirm: {default: true},
		closeMessage: {default: 'Close'},
		confirmMessage: {default: 'OK'},
		title: {default: 'Title'},
		large: Boolean,
	},
	computed: {
		classes(): Record<string, boolean> {
			return {
				'modal': true,
				'fade': true,
				'in': true,
				'custom-modal': true,
				'modal-fullwidth': this.large
			}
		}
	},
})
</script>

<style lang="scss">
.custom-modal {
	background: rgba(0, 0, 0, 0.5);
	.modal-dialog {
		display: flex;
		max-height: calc(100vh - 60px); // builtin margins.

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
