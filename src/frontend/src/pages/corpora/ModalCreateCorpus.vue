<template>
    <Modal>
		<template #title>Create New Corpus</template>
		<template #body>
			<div class="container-fluid">
				<div class="form-group">
					<label>Corpus Name <input maxlength="80" class="form-control" v-model="corpusName"></label>
				</div>
				<div class="form-group">
					<label for="corpus_document_type" title="The format of the documents that will be stored in the corpus">Document Format</label>
					<br>
					<SelectPicker :loading="loading" :options="documentTypes" showHtml v-model="documentType"/>
					<small v-if="selectedFormat" class="text-muted" style="display: block; padding: 8px 8px 0px;">{{selectedFormat.description}}</small>
					<small v-if="selectedFormat && selectedFormat.helpUrl" style="display: block; padding: 8px 8px 0px;"><a target="_blank" :href="selectedFormat.helpUrl">More information</a></small>
				</div>
			</div>
		</template>
		<template #footer>
			<button type="button" class="btn btn-default" @click="$emit('close')">Cancel</button>
			<button type="button" class="btn btn-primary" @click="createCorpus" :disabled="!corpusName || !documentType">Create</button>
		</template>
	</Modal>
</template>
<script lang="ts">
import Vue from 'vue';
import Modal from './Modal.vue';
import { NormalizedFormat } from '@/types/apptypes';
import { Options } from '@/components/SelectPicker.vue';
import { BLUser } from '@/types/blacklabtypes';
import * as Api from '@/api';
export default Vue.extend({
    components: {Modal},
	props: {
		publicFormats: Array as () => NormalizedFormat[],
		privateFormats: Array as () => NormalizedFormat[],
		loading: Boolean,
		user: Object as () => BLUser
	},
	data: () => ({
		corpusName: '',
		documentType: '',
	}),
	computed: {
		selectedFormat(): NormalizedFormat|undefined {
			return this.publicFormats?.find(f => f.id === this.documentType) || this.privateFormats?.find(f => f.id === this.documentType);
		},
		formatOptions(): Options {
			const r: Options = [];
			if (this.publicFormats) r.push({label: 'Public', options: this.publicFormats.map(f => ({value: f.id, label: `${f.displayName} <small>${f.id}</small>`}))});
			if (this.privateFormats) r.push({label: 'Custom', options: this.privateFormats.map(f => ({value: f.id, label: `${f.displayName} <small>${f.id}</small>`}))});
			return r;
		}
	},
	methods: {
		createCorpus() {
			if (!this.documentType || !this.corpusName || !this.user.loggedIn || !this.user.id) return;

			// Prefix the user name because it's a private index
			const indexName = this.user.id + ':' + this.corpusName.replace(/[\s\\/:]+/g, '_');
			const displayName = this.corpusName;

			Api.blacklab
			.postCorpus(indexName, displayName, this.documentType)
			.then(() => {
				this.$emit('create');
				this.$emit('success', `Corpus "${displayName}" created.`);
			})
			.catch((e: Api.ApiError) => this.$emit('error', `Could not create corpus "${displayName}": ${e.message}`))
			.finally(() => this.$emit('close'));
		}
	}
})

</script>