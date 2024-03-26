<template>
<div class="container">

	<Spinner v-if="busy" lg overlay/>
	<!-- <span v-if="busy" class="fa fa-spinner fa-spin searchIndicator" style="position: absolute; left: 50%; display: none;"></span> -->

	<div v-if="!busy && !serverInfo && errorMessage" class="alert alert-danger">
		Error loading BlackLab info, try refreshing the page.
		<p>{{ errorMessage }}</p>
	</div>
	<div v-else-if="successMessage" class="alert alert-success">
		<a href="#" class="close" data-dismiss="alert" aria-label="close" @click="successMessage = ''">×</a>
		{{ successMessage }}
	</div>
	<div v-else-if="errorMessage" class="alert alert-danger">
		<a href="#" class="close" aria-label="close" @click="errorMessage = ''">×</a>
		{{ errorMessage }}
	</div>

	<template v-if="serverInfo">
		<div v-if="!corpora.length && !loadingCorpora" class="cf-panel cf-panel-lg" >
			<h2>No corpora available</h2>
			<p>No corpora have been added to BlackLab. Corpora will appear here when when they become available.</p>
		</div>
		<template v-else>
			<CorpusTable v-if="publicCorpora.length" :loading="loadingCorpora" :corpora="publicCorpora" :formats="formats" title="Public corpora"/>
			<!-- always shown if logged in -->
			<CorpusTable v-if="loggedIn" :loading="loadingCorpora" :corpora="privateCorpora" :formats="formats" title="Your corpora" isPrivate :canCreateCorpus="canCreateCorpus"
				@share="doShareCorpus"
				@upload="doUploadCorpus"
				@delete="doDeleteCorpus"
			/>
		</template>

		<FormatsTable v-if="loggedIn"
			:formats="privateFormats"
			:loading="loadingFormats"
			@create="doCreateFormat"
			@edit="doEditFormat"
			@delete="doDeleteFormat"
		/>

		<!-- Modals -->
		<ModalCreateFormat v-if="modal === 'create-format'"
			:publicFormats="publicFormats"
			:privateFormats="privateFormats"
			:loading="loadingFormats"
			:format="format"

			@create="refreshFormats"
			@success="success"
			@error="error"
			@close="close"
		/>
		<ModalCreateCorpus v-if="modal === 'create-corpus'" :publicFormats="publicFormats" :privateFormats="privateFormats" :loading="loadingFormats" @create="refreshCorpora" @success="success" @error="error" @close="close"/>
		<ModalUpload       v-if="modal === 'upload'"        :corpus="corpus" :formats="formats" @index="refreshCorpus" @success="success" @error="error" @close="close"/>
		<ModalShareCorpus  v-if="modal === 'share-corpus'"  :corpus="corpus" @success="success" @error="error" @close="close"/>
		<ModalConfirm      v-if="modal === 'confirm'"
			:title="confirmTitle"
			:message="confirmMessage"
			@confirm="confirmAction"
			@close="close"
		/>
	</template>
</div>

</template>
<script lang="ts">
import Vue from 'vue';
import { NormalizedFormat, NormalizedIndexBase } from '@/types/apptypes';
import { BLServer } from '@/types/blacklabtypes';
import * as Api from '@/api';
import { normalizeIndexBase } from '@/utils/blacklabutils';

import Spinner from '@/components/Spinner.vue';
import CorpusTable from './CorpusTable.vue';
import FormatsTable from './FormatsTable.vue';
import ModalConfirm from '@/pages/corpora/ModalConfirm.vue';
import ModalCreateCorpus from '@/pages/corpora/ModalCreateCorpus.vue';
import ModalCreateFormat from '@/pages/corpora/ModalCreateFormat.vue';
import ModalUpload from '@/pages/corpora/ModalUpload.vue';
import ModalShareCorpus from '@/pages/corpora/ModalShare.vue';

export default Vue.extend({
	components: {Spinner, CorpusTable, FormatsTable, ModalCreateCorpus, ModalCreateFormat, ModalUpload, ModalShareCorpus, ModalConfirm},
	data: () => ({
		corpora: [] as NormalizedIndexBase[],
		formats: [] as NormalizedFormat[],
		serverInfo: undefined as any as BLServer,
		errorMessage: '',
		successMessage: '',
		confirmMessage: '',
		confirmTitle: '',
		confirmAction: undefined as (() => void)|undefined,

		loadingFormats: false,
		loadingCorpora: false,
		loadingServerInfo: false,

		modal: '',

		corpus: null as null|NormalizedIndexBase,
		format: null as null|NormalizedFormat,
	}),

	computed: {
		loggedIn(): boolean { return this.serverInfo?.user?.loggedIn; },
		publicCorpora(): NormalizedIndexBase[] { return this.corpora.filter(c => !c.owner); },
		privateCorpora(): NormalizedIndexBase[] { return this.corpora.filter(c => c.owner); },
		publicFormats(): NormalizedFormat[] { return this.formats.filter(f => !f.owner); },
		privateFormats(): NormalizedFormat[] { return this.formats.filter(f => f.owner); },
		canCreateCorpus(): boolean { return this.loggedIn && this.serverInfo?.user.canCreateIndex; },

		busy(): boolean { return this.loadingFormats || this.loadingCorpora || this.loadingServerInfo; },
	},
	methods: {
		success(message: string) {
			this.successMessage = message;
			this.errorMessage = '';
		},
		error(message: string) {
			this.errorMessage = message;
			this.successMessage = '';
		},
		refreshCorpora() {
			this.loadingCorpora = true;
			Api.blacklab.getCorpora().then(corpora => this.corpora = corpora)
			.catch((e: Api.ApiError) => this.errorMessage = e.message)
			.finally(() => this.loadingCorpora = false)
		},
		refreshFormats() {
			this.loadingFormats = true;
			Api.blacklab.getFormats().then(formats => this.formats = formats)
			.catch((e: Api.ApiError) => this.errorMessage = e.message)
			.finally(() => this.loadingFormats = false)
		},
		async refreshCorpus(id: string) {
			let i = this.corpora.findIndex(c => c.id === id);
			try {
				while (true) {
					const index = await Api.blacklab.getCorpusStatus(id);
					this.corpora.splice(i, 1, index);
					if (index.status !== 'indexing') return;
					await new Promise(resolve => setTimeout(resolve, 2000));
				}
			} catch (error) {
				this.errorMessage = `Could not retrieve status for corpus "${this.corpora[i].displayName}": ${error.message}`;
			}
		},
		close() { this.modal = ''; this.corpus = this.format = null; },
		doCreateCorpus() { this.modal = 'create-corpus'; },
		doCreateFormat() { this.modal = 'create-format'; },
		doUploadCorpus(corpus: NormalizedIndexBase) { this.corpus = corpus; this.modal = 'upload'; },
		doShareCorpus(corpus: NormalizedIndexBase) { this.corpus = corpus; this.modal = 'share-corpus'; },
		doEditFormat(format: NormalizedFormat) {
			this.format = format;
			this.modal = 'create-format';
		},
		doDeleteCorpus(corpus: NormalizedIndexBase) {
			this.corpus = corpus;
			this.confirmMessage = `Are you sure you want to delete corpus "${corpus.displayName}"?`;
			this.modal = 'confirm';
			this.confirmAction = () => {
				debugger;
				this.close();
				this.loadingCorpora = true;
				Api.blacklab.deleteCorpus(corpus.id)
				.then(r => {
					this.successMessage = r.status.message;
					this.corpora = this.corpora.filter(c => c.id !== corpus.id);
				})
				.catch((e: Api.ApiError) => this.errorMessage = `Could not delete corpus "${corpus.displayName}": ${e.message}`)
				.finally(() => {
					this.confirmAction = undefined;
					this.loadingCorpora = false;
				});
			}
		},
		doDeleteFormat(format: NormalizedFormat) {
			this.confirmTitle = 'Delete import format?';
			this.confirmMessage = `You are about to delete the import format <i>${format.id}</i>.<br>Are you sure?`,
			this.modal = 'confirm';
			this.confirmAction = () => {
				this.close();
				this.loadingFormats = true;
				Api.blacklab.deleteFormat(format.id)
				.then(r => {
					this.successMessage = r.status.message;
					this.formats = this.formats.filter(f => f.id !== format.id);
				})
				.catch((e: Api.ApiError) => this.errorMessage = `Could not delete format "${format.displayName}": ${e.message}`)
				.finally(() => {
					this.confirmAction = undefined;
					this.loadingFormats = false;
				});
			}
		},
	},
	async created() {
		try {
			this.loadingFormats = this.loadingCorpora = this.loadingServerInfo = true;
			try { this.serverInfo = await Api.blacklab.getServerInfo(); }
			catch (e) {
				this.errorMessage = `Error loading BlackLab info: ${e.message}`;
				this.loadingCorpora = this.loadingFormats = this.loadingServerInfo = false;
				return;
			}

			this.loadingServerInfo = false;
			this.corpora = Object.entries(this.serverInfo.indices).map(([id, index]) => normalizeIndexBase(index, id));
			this.loadingCorpora = false;
			this.refreshFormats();
		} catch (error) {
			if (error instanceof Api.ApiError)
				this.errorMessage = error.message;
			else
				this.errorMessage = 'An unknown error occurred: ' + JSON.stringify(error);
			this.loadingCorpora = this.loadingFormats = this.loadingServerInfo = false;
		}
	}
})

</script>

<style scoped>
.alert {
	margin-left: -15px;
	margin-right: -15px;
}
</style>