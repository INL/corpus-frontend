<template>

<Modal>
	<template #title>{{ title }}</template>
	<template #body><p>{{ body }}</p></template>
	<template #footer>
		<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
		<button type="button" class="btn btn-primary" @click="$emit('confirm')">OK</button>
	</template>
</Modal>
</template>

<script lang="ts">
import Vue from 'vue';
import Modal from './Modal.vue';
export default Vue.extend({
	components: {Modal},
	props: {
		title: String,
		body: String,
	}
});
</script>