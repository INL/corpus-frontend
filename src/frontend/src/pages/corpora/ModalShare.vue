<template>
	<Modal>
		<template #title>Sharing options for corpus <em>{{ corpus.displayName }}</em></template>
		<template #header><small class="text-muted">One username per line</small></template>

		<textarea v-model="content" style="width:100%; height: 400px; resize: vertical;" class="form-control"></textarea>

		<template #footer>
			<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
			<button type="button" class="btn btn-primary" @click="save" :disabled="loading">Save</button>
		</template>
	</Modal>
</template>

<script lang="ts">
import Vue from 'vue';
import Modal from './Modal.vue';
import { NormalizedIndexBase } from '@/types/apptypes';
import * as Api from '@/api';
export default Vue.extend({
	components: {Modal},
	props: {
		corpus: Object as () => NormalizedIndexBase
	},
	data: () => ({
		content: '',
		loading: false
	}),
	methods: {
		save() {
			this.loading = true;
			Api.blacklab.postShares(this.corpus.id, this.content.split('\n'))
			.then(r => {
				this.$emit('success', r.status.message)
				this.$emit('close');
			})
			.catch((e: Api.ApiError) => this.$emit('error', `Could not save shares for corpus "${this.corpus.displayName}": ${e.message}`))
			.finally(() => this.loading = false);

		}
	},
	created() {
		this.loading = true;
		Api.blacklab.getShares(this.corpus.id)
		.then(shares => this.content = shares.join('\n'))
		.catch((e: Api.ApiError) => this.$emit('error', `Could not retrieve share list for corpus "${this.corpus.displayName}": ${e.message}`))
		.finally(() => this.loading = false);
	}
});
</script>