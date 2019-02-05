<template>
	<div class="container">
		<div class="panel cf-panel cf-panel-lg">
			<div v-if="!isInitialized && !error" class="text-center">
				<h3>Loading your corpora...</h3>
				<span class="fa fa-spinner fa-spin" style="font-size:60px;"/>
			</div>


			<div v-else-if="!selectedCorpus">
				<h3>Please pick a corpus</h3>
				<form class="form-group" @submit.prevent="download">
					<label for="corpus_select">Add files to an existing corpus...</label>
					<div class="input-group">
						<SelectPicker
							hideEmpty
							allowHtml
							data-width="100%"
							data-id="corpus_select"

							:options="availableCorporaOptions"
							:loading="isLoadingCorpora"
							:placeholder="isLoadingCorpora ? 'Loading your corpora...' : 'Select a corpus'"
							:disabled="isLoadingCorpora"

							v-model="preselectedCorpus"

							@input="log('input', $event)"
							@change="log('change', $event)"
						/>
						<div class="input-group-btn">
							<button type="submit" class="btn btn-primary" :disabled="!preselectedCorpus">Select</button>
						</div>
					</div>
				</form>

				<form :class="{
					'form-group': true,
					'has-error': !newCorpusNameValid
				}" @submit.prevent="createCorpus">
					<label for="new_corpus_name">or create a new corpus and add to that...</label>
					<div class="input-group">
						<input type="text" class="form-control" :disabled="isCreatingCorpus" placeholder="Name" name="new_corpus_name" id="new_corpus_name" v-model="newCorpusName" />
						<div class="input-group-btn">
							<button type="submit" class="btn btn-primary" :disabled="!newCorpusNameValid || isCreatingCorpus || !newCorpusName.length || !blacklabData.user">
								<span v-if="isCreatingCorpus" class="fa fa-spinner fa-spin"/> Create
							</button>
						</div>
					</div>
					<span v-if="!newCorpusNameValid" class="help-block">Illegal corpus name. Corpus name must be between 3 and 30 characters and may not contain special characters.</span>
				</form>
			</div>
			<div v-else-if="!error">
				<h3 class="text-center">{{actionTitle}}</h3>
				<div class="progress">
					<div class="progress-bar progress-bar-striped" :style="{width: this.progress + '%'}">
						{{action}}
					</div>
				</div>
			</div>

			<div v-if="error">
				<span class="text-danger"><span class="fa fa-exclamation-triangle"></span> {{error}}</span><br>
				<button v-if="retryError" class="btn btn-default btn-sm" @click="retryError(), error = null, retryError = null">Retry</button>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import Axios from 'axios';

import UrlStateParserBase from '@/store/util/url-state-parser-base';
import {blacklab, paths} from '@/api';
import {debugLog} from '@/utils/debug';

import SelectPicker, {OptGroup} from '@/components/SelectPicker.vue';

import * as AppTypes from '@/types/apptypes';
import * as BLTypes from '@/types/blacklabtypes';

declare const CONTEXT_URL: string;

class UrlStateParser extends UrlStateParserBase<{
	file: string;
	format: string;
	corpus: null|string,
}> {
	public get() {
		return {
			file: this.getString('file', '')!,
			format: this.getString('format', 'folia')!,
			corpus: this.getString('corpus', null, v => v ? v : null)
		}
	}
}

export default Vue.extend({
	components: {
		SelectPicker
	},
	data: () => ({
		urlParams: new UrlStateParser().get(),

		error: null as null|string, // TODO
		retryError: null as null|(() => void),

		blacklabData: {
			corpora: [] as AppTypes.NormalizedIndexOld[],
			user: null as null|BLTypes.BLUser
		},

		// Some state
		isInitialized: false,
		isLoadingCorpora: false,
		isCreatingCorpus: false,

		// Creating/selecting a new corpus
		newCorpusName: '',
		preselectedCorpus: '',
		selectedCorpus: null as null|AppTypes.NormalizedIndexOld,

		actionTitle: '',
		action: '',
		progress: 0,
	}),
	computed: {
		newCorpusNameValid(): boolean { return !!this.newCorpusName.match(/^(?:[\w \.,\-'"]{3,30}|)$/); },

		availableCorporaOptions(): OptGroup[] {
			if (!this.blacklabData.user) {
				return [];
			}

			return [{
				label: this.blacklabData.user!.id,
				options: this.blacklabData.corpora
					.filter(c => c.owner === this.blacklabData.user!.id && c.documentFormat === this.urlParams.format)
					.sort((a, b) => a.displayName.localeCompare(b.displayName))
					.map(c => ({
						label: `${c.displayName} ${c.tokenCount ? `<small class="text-muted">(${Math.floor(c.tokenCount!).toLocaleString()} tokens)</small>` : ''}`,
						value: c.id,
						disabled: c.status !== 'available' && c.status !== 'empty',
						title: `${c.id} (${c.status})`
					}))
			}];
		},
	},

	methods: {
		log() { console.log(...arguments); },

		init(): void {
			this.error = null;
			this.retryError = null;

			this.isLoadingCorpora = true;
			Promise.all([
				blacklab.getCorpora(),
				blacklab.getUser()
			])
			.then(([corpora, user]) => {
				this.blacklabData.corpora = corpora;
				this.blacklabData.user = user;

				if (this.urlParams.corpus) {
					if (this.urlParams.corpus.indexOf(':') === -1) {
						this.urlParams.corpus = `${user.id}:${this.urlParams.corpus}`;
					}

					Vue.nextTick(() => {
						this.preselectedCorpus = this.urlParams.corpus!;
						Vue.nextTick(() => {
							// hack, if urlParams.corpus is invalid, the selectPicker will reset the value to empty the next frame
							// check that here, then, initiate the download if it's valid, otherwise initiate corpus creation
							if (this.preselectedCorpus) {
								this.download();
							} else {
								this.newCorpusName = this.urlParams.corpus!.substring(this.urlParams.corpus!.indexOf(':')+1);
								this.createCorpus();
							}
						})
					})
				}
				this.isInitialized = true;
			})
			.catch(error => {
				this.error = error;
				this.retryError = this.init;
			})
			.finally(() => this.isLoadingCorpora = false)
		},

		createCorpus(): void {
			if (!this.newCorpusNameValid) {
				return;
			}

			this.error = null;
			this.retryError = null;

			const id = `${this.blacklabData.user!.id}:${this.newCorpusName.replace(/[^\w-]/g, '_')}`;
			this.isCreatingCorpus = true;
			blacklab.postCorpus(id, this.newCorpusName, this.urlParams.format)
			.then(() => {
				this.isCreatingCorpus = false;
				this.isLoadingCorpora = true;
				this.newCorpusName = '';
				return blacklab.getCorpora();
			})
			.then(corpora => {
				this.isLoadingCorpora = false;
				this.blacklabData.corpora = corpora;
				this.preselectedCorpus = id;
				this.download();
			})
			.catch(e => {
				this.error = e.message;
				this.retryError = this.createCorpus;
			})
			.finally(() => {
				this.isCreatingCorpus = false;
				this.isLoadingCorpora = false;
			})
		},

		async download() {
			this.selectedCorpus = this.blacklabData.corpora.find(c => c.id === this.preselectedCorpus) || null;
			if (!this.selectedCorpus) {
				return;
			}

			this.actionTitle = 'Downloading file(s)';
			this.action = 'Starting download...';

			let file: File;
			try {
				const r = await Axios.get(this.urlParams.file, {
					responseType: 'blob',
					onDownloadProgress: (event: ProgressEvent) => {
						if (!event.total) {
							this.progress = 100;
							this.action = `Downloading... (${Math.floor(event.loaded / 1_048_576).toLocaleString()}MB)`
						}
						else {
							this.progress = event.loaded/event.total*100;
							this.action = `Downloading... (${Math.floor(this.progress)}%)`
						}
					}
				})

				// throw new Error('Test error from download');

				file = new File([new Blob([r.data])], this.urlParams.file);
			} catch (e) {
				this.error = e.message;
				this.retryError = this.download;
				return;
			}

			this.progress = 0;
			this.actionTitle = `Uploading file(s) to ${this.selectedCorpus!.displayName}`;
			this.action = `Starting upload...`;

			let indexError: string|undefined = undefined;

			// we need to use a promise here because we want to continue before the request is wholly finished
			try {
				await new Promise((resolve, reject) => {
					let resolved = false;
					const { request, cancel } = blacklab.postDocuments(
						this.selectedCorpus!.id,
						[file],
						undefined,
						p => {
							if (p >= 100) {
								resolve();
								resolved = true;
							}
							this.progress = p;
							this.action = `Uploading... (${Math.floor(this.progress)}%)`
						}
					);

					// can't always just use reject() here, as we might have already called resolve
					request.catch(uploadError => {
						if (resolved) {
							indexError = uploadError.message;
						} else {
							reject(uploadError);
						}
					});
				});
			} catch (uploadError) {
				this.error = uploadError.message;
				this.retryError = this.download;
				return;
			}

			try {
				let indexProgress: BLTypes.BLIndexProgress|null = null;
				while (({indexProgress} = await blacklab.getCorpus(this.selectedCorpus!.id)) != null && !indexError) {
					const {filesProcessed: files, docsDone: docs, tokensProcessed: tokens} = indexProgress!;
					this.action = `Indexing... - ${files} files, ${docs} documents, and ${tokens} tokens indexed so far...`;
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			} catch (e) {
				indexError = e.message;
			}

			if (indexError) {
				this.error = indexError;
				this.retryError = () => {
					this.selectedCorpus = null;
					this.preselectedCorpus = '';
					this.newCorpusName = '';
					this.progress = 0;
					this.action = '';
					this.actionTitle = '';
				};
				return;
			}

			this.action = 'Finished! Opening search page...';
			window.setTimeout(() => window.location.href = CONTEXT_URL + '/' + this.selectedCorpus!.id + '/search/', 5000);
		},
	},
	created() {
		if (!this.urlParams.file) {
			this.error = 'No file specified, redirecting...';
			window.location.href = CONTEXT_URL;
			return;
		}

		this.init();
	}
})
</script>

<style scoped lang="scss">
.progress {
	height: 30px;
	> .progress-bar {
		line-height: 30px;
		text-overflow: visible;
		overflow: visible;
	}
}
</style>