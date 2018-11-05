<template>
	<div class="form-group propertyfield" :id="id"> <!-- behaves as .row when in .form-horizontal so .row may be omitted -->
		<label :for="inputId" class="col-xs-12 col-md-3" :title="annotation.description || undefined">{{displayName}}</label>
		<div class="col-xs-12 col-md-9 upload-button-container">
			<SelectPicker v-if="annotation.uiType === 'select'"
				class="form-control"
				data-container="body"

				:title="displayName"
				:id="inputId"
				:name="inputId"

				:options="options"

				v-model="value"
			/>
			<template v-else>
				<input
					type="text"
					class="form-control"

					:id="inputId"
					:name="inputId"
					:placeholder="displayName"
					:autocomplete="autocomplete ? 'off' : undefined"

					ref="autocomplete"
					v-model="value"
				/>
				<span class="btn btn-default upload-button">
					<input
						type="file"
						title="Upload a list of values"

						:id="fileInputId"

						@change="onFileChanged"
					>
					<span class="glyphicon glyphicon-open"></span>
				</span>
			</template>
			<div v-if="annotation.caseSensitive" class="checkbox">
				<label :for="caseInputId">
					<input
						type="checkbox"

						:id="caseInputId"
						:name="caseInputId"

						v-model="caseSensitive"
					>
					Case&nbsp;and&nbsp;diacritics&nbsp;sensitive
				</label>
			</div>
		</div>
	</div>

</template>

<script lang="ts">
import Vue from 'vue';

import $ from 'jquery';

import * as formStore from '@/store/form';
import { NormalizedAnnotation } from '@/types/apptypes';
import SelectPicker, {Option} from '@/components/SelectPicker.vue';

import Autocomplete from '@/mixins/autocomplete';

declare const BLS_URL: string;

// TODO use description, use annotatedField description and properties and stuff

export default Vue.extend({
	mixins: [Autocomplete],
	components: {
		SelectPicker,
	},
	props: {
		annotation: Object as () => NormalizedAnnotation
	},
	computed: {
		inputId(): string { return this.annotation.id + '_value'; },
		fileInputId(): string { return this.annotation.id + '_file'; },
		caseInputId(): string { return this.annotation.id + "_case"; },

		id(): string { return /*this.annotation.annotatedFieldId + '_' +*/ this.annotation.id },
		displayName(): string { return this.annotation.displayName },

		options(): Option[] { return this.annotation.values || [] },

		autocomplete(): boolean { return this.annotation.uiType === 'combobox'; },
		autocompleteUrl(): string { return `${BLS_URL}/autocomplete/${this.annotation.annotatedFieldId}/${this.annotation.id}`},

		value: {
			get(): string {
				return formStore.get.annotationValue(this.annotation.annotatedFieldId, this.id).value;
			},
			set(value: string) {
				formStore.actions.pattern.simple.annotation({
					annotatedFieldId: this.annotation.annotatedFieldId,
					id: this.id,
					value
				})
			}
		},
		caseSensitive: {
			get(): boolean {
				return formStore.get.annotationValue(this.annotation.annotatedFieldId, this.id).case;
			},
			set(caseSensitive: boolean) {
				formStore.actions.pattern.simple.annotation({
					annotatedFieldId: this.annotation.annotatedFieldId,
					id: this.id,
					case: caseSensitive
				});
			}
		}
	},
	methods: {
		autocompleteSelected(value: string) { this.value = value; },
		onFileChanged(event: Event) {
			const self = this;
			const fileInput = event.target as HTMLInputElement;
			const file = fileInput.files && fileInput.files[0];
			if (file != null) {
				const fr = new FileReader();
				fr.onload = function() {
					// Replace all whitespace with pipes,
					// this is due to the rather specific way whitespace in the simple search property fields is treated (see singlepage-bls.js:getPatternString)
					// TODO discuss how we treat these fields with Jan/Katrien, see https://github.com/INL/corpus-frontend/issues/18
					self.value = (fr.result as string).replace(/\s+/g, '|');
				};
				fr.readAsText(file);
			} else {
				self.value = '';
			}
		}
	},
})
</script>

<style lang="scss">
</style>