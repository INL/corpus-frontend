<template>
	<div :class="bare ? '' : 'form-group propertyfield'" :id="htmlId"> <!-- behaves as .row when in .form-horizontal so .row may be omitted -->
		<label v-if="!bare" :for="inputId" class="col-xs-12 col-md-3" :title="annotation.description || undefined">{{displayName}} <Debug>(id: {{annotation.id}})</Debug></label>
		<div :class="bare ? '' : 'col-xs-12 col-md-9'">
			<SelectPicker v-if="annotation.uiType === 'select'"
				data-width="100%"
				container="body"

				:searchable="options.length > 12"
				:placeholder="displayName"
				:data-id="inputId"
				:data-name="inputId"
				:data-dir="textDirection"

				:options="options"

				v-model="value"
			/>
			<Lexicon v-else-if="annotation.uiType === 'lexicon'"
				:annotationId="annotation.id"
				:definition="annotation"

				v-model="value"

				ref="reset"
			/>
			<div v-else :class="bare ? '' : 'input-group'">
				<Autocomplete
					type="text"
					class="form-control"

					useQuoteAsWordBoundary

					:id="inputId"
					:name="inputId"
					:placeholder="displayName"
					:disabled="annotation.uiType === 'pos'"
					:dir="textDirection"

					:autocomplete="autocomplete"
					:url="autocompleteUrl"
					v-model="value"
				/>
				<div v-if="!bare" class="input-group-btn">
					<a v-if="annotation.uiType === 'pos'"
						data-toggle="modal"
						class="btn btn-default"

						:href="`#pos_editor${uid}`"
					>
						<span class="fa fa-pencil fa-fw"/>
					</a>

					<label class="btn btn-default file-input-button" :for="fileInputId" v-if="annotation.uiType !== 'pos'">
						<span class="fa fa-upload fa-fw"></span>
						<input
							type="file"
							title="Upload a list of values"

							:id="fileInputId"

							@change="onFileChanged"
						>
					</label>
				</div>
			</div>
			<template v-if="annotation.uiType === 'pos'">
				<PartOfSpeech
					:id="`pos_editor${uid}`"
					:annotationId="annotation.id"
					:annotationDisplayName="annotation.displayName"

					@submit="value = $event.queryString"

					ref="reset"
				/>
			</template>
			<div v-if="annotation.caseSensitive && !bare" class="checkbox">
				<label :for="caseInputId">
					<input
						type="checkbox"

						:id="caseInputId"
						:name="caseInputId"

						v-model="caseSensitive"
					>
					{{$t('annotation.caseSensitive')}}
				</label>
			</div>
		</div>
	</div>

</template>

<script lang="ts">
import Vue from 'vue';

import * as RootStore from '@/store/search/';
import * as CorpusStore from '@/store/search/corpus';
import * as PatternStore from '@/store/search/form/patterns';

import SelectPicker, {Option} from '@/components/SelectPicker.vue';
import PartOfSpeech from '@/pages/search/form/PartOfSpeech.vue';
import Autocomplete from '@/components/Autocomplete.vue';
import Lexicon from '@/pages/search/form/Lexicon.vue';
import UID from '@/mixins/uid';

import {blacklabPaths} from '@/api';
import { AnnotationValue, NormalizedAnnotation } from '@/types/apptypes';

export default Vue.extend({
	mixins: [UID],
	components: {
		SelectPicker,
		PartOfSpeech,
		Autocomplete,
		Lexicon
	},
	props: {
		annotation: Object as () => NormalizedAnnotation,
		htmlId: String,
		bare: Boolean,
		/**
		 * Set to true if this annotation is the "simple" annotation. I.e. the Annotation in the "simple" tab of the search form.
		 * This will change which field the value is written to the vuex store.
		 */
		simple: Boolean
	},
	data: () => ({
		subscriptions: [] as Array<() => void>,
	}),
	computed: {
		stateGetter(): () => AnnotationValue {
			return this.simple ?
				() => PatternStore.get.simple().annotationValue :
				PatternStore.get.annotationValue.bind(this, this.annotation.annotatedFieldId, this.annotation.id);
		},
		stateSetter(): (payload: Partial<AnnotationValue> & { id: string }) => void {
			return this.simple ? PatternStore.actions.simple.annotation : PatternStore.actions.extended.annotation;
		},
		textDirection(): string|undefined {
			// only set direction if this is the main annotation
			// so we don't set rtl mode on things like part-of-speech etc.
			return this.annotation.isMainAnnotation ? CorpusStore.get.textDirection() : undefined;
		},
		inputId(): string { return this.htmlId + '_value'; },
		fileInputId(): string { return this.htmlId + '_file'; },
		caseInputId(): string { return this.htmlId + '_case'; },

		displayName(): string { return this.annotation.displayName; },

		options(): Option[] { return this.annotation.values || []; },

		autocomplete(): boolean { return this.annotation.uiType === 'combobox'; },
		autocompleteUrl(): string { return blacklabPaths.autocompleteAnnotation(INDEX_ID, this.annotation.annotatedFieldId, this.annotation.id); },

		value: {
			get(): string {
				return this.stateGetter().value;
			},
			set(value: string) {
				this.stateSetter({
					id: this.annotation.id,
					value
				});
			}
		},
		caseSensitive: {
			get(): boolean {
				return this.stateGetter().case;
			},
			set(caseSensitive: boolean) {
				this.stateSetter({
					id: this.annotation.id,
					case: caseSensitive
				});
			}
		}
	},
	methods: {
		onFileChanged(event: Event) {
			const self = this;
			const fileInput = event.target as HTMLInputElement;
			const file = fileInput.files && fileInput.files[0];
			if (file != null) {
				const fr = new FileReader();
				fr.onload = function() {
					// Replace all whitespace with pipes,
					// Same as the querybuilder wordlist upload
					self.value = (fr.result as string).trim().replace(/\s+/g, '|');
				};
				fr.readAsText(file);
			} else {
				self.value = '';
			}
			(event.target as HTMLInputElement).value = '';
		}
	},
	mounted() {
		if (this.$refs.reset) {
			const eventId = `${PatternStore.namespace}/reset`;

			this.subscriptions.push(RootStore.store.subscribe((mutation, state) => {
				if (this.$refs.reset && mutation.type === eventId) {
					(this.$refs.reset as any).reset();
				}
			}));
		}
	},
	destroyed() {
		this.subscriptions.forEach(unsub => unsub());
	}
});
</script>

<style lang="scss">
</style>
