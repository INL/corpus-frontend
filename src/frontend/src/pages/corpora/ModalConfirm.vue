<template>

<Modal
	:closeMessage="cancel"
	:confirmMessage="confirm"
	:confirmClass="confirmClass"
	@close="$emit('close')"
	@confirm="$emit('confirm')"
>
	<template #title><h4>{{ title }}</h4></template>
	<template #body><p v-html="message"></p></template>
</Modal>
</template>

<script lang="ts">
import Vue from 'vue';
import Modal from './Modal.vue';
export default Vue.extend({
	components: {Modal},
	props: {
		cancel: {default: 'Cancel'},
		confirm: {default: 'OK'},
		confirmClass: {default: 'btn-primary'},
		title: {default: 'Confirm'},
		message: {default: 'Are you sure?'},
	}
});
</script>