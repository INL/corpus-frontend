<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="(uiType === 'select' || uiType === 'text') ? inputId : undefined">{{displayName}}</label>

		<template v-if="uiType === 'select'">
			<div class="col-xs-12">
				<SelectPicker
					class="selectpicker form-control"
					data-container="body"
					multiple

					:title="displayName"
					:id="inputId"
					:name="inputId"
					:options="options"

					v-model.lazy="valueAdapterMultipleArray"
				/>
			</div>
		</template>
		<template v-else-if="uiType === 'range'">
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_lower'" placeholder="From" class="form-control" autocomplete="off" v-model.lazy="valueAdapterRange.low">
			</div>
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_upper'" placeholder="To" class="form-control" autocomplete="off" v-model.lazy="valueAdapterRange.high">
			</div>
		</template>
		<template v-else-if="uiType === 'checkbox'">
			<div class="col-xs-12">
				 <div class="checkbox" v-for="(option, index) in options" :key="index">
					<!-- TODO optimize this, currently rewriting all values, ergo rerendering all checkboxes every time one changes -->
					<label :for="inputId+'_'+index"><input
						type="checkbox"

						:value="option.value"
						:name="inputId+'_'+index"
						:id="inputId+'_'+index"

						v-model="valueAdapterMultipleMap[option.value]"

					> {{option.label || option.value}}</label>
				</div>
			</div>
		</template>
		<template v-else-if="uiType === 'radio'">
			<div class="col-xs-12">
				 <div class="radio" v-for="(option, index) in options" :key="index">
					<label :for="inputId+'_'+index"><input
						type="radio"
						:value="option.value"
						:name="inputId"
						:id="inputId+'_'+index"

						v-model="valueAdapterSingle"
						@click="$event.target.checked ? valueAdapterSingle = '' : undefined /* clear if clicked again */"
						@input.space="$event.target.checked ? valueAdapterSingle = '' : undefined /* clear if clicked again */"
					> {{option.label || option.value}}</label>
				</div>
			</div>
		</template>
		<template v-else> <!-- should always be uiType === 'text' -->
			<div class="col-xs-12">
				<input
					type="text"
					class="form-control"

					:id="inputId"
					:placeholder="displayName"
					:autocomplete="autocomplete"

					ref="autocomplete"
					v-model.lazy="valueAdapterSingle"
				/>
			</div>
		</template>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/corpus';
import * as FormStore from '@/store/form';

import SelectPicker, {Option} from '@/components/SelectPicker.vue';

//@ts-ignore
import Autocomplete from '@/mixins/autocomplete';

declare const BLS_URL: string;

export default Vue.extend({
	mixins: [Autocomplete],
	components: {
		SelectPicker
	},
	props: {
		filter: Object as () => CorpusStore.NormalizedMetadataField,
	},
	data: () => ({
		valueAdapterMultipleMap: {} as { [value: string]: boolean, }
	}),
	computed: {
		id(): string { return this.filter.id },
		displayName(): string { return this.filter.displayName },
		uiType(): CorpusStore.NormalizedMetadataField['uiType'] { return this.filter.uiType; },

		inputId(): string { return this.filter.id + '_value'; },

		options(): Option[] { return this.filter.values || []; },

		autocomplete(): boolean { return this.filter.uiType === 'combobox'; },
		autocompleteUrl(): string { return `${BLS_URL}/autocomplete/${this.filter.id}`},

		// we need some adapters to translate from string[] -> string
		// or from string[] -> { key: boolean }
		// and vice-versa
		// or we get errors where we mutate inside arrays in the store directly etc

		// text, radio, combobox
		valueAdapterSingle: {
			get(): string { return FormStore.get.metadataValue(this.id).values[0] || ''; },
			set(v: string): void {
				return FormStore.actions.filter({
					id: this.id,
					values: [v]
				});
			}
		},

		valueAdapterRange(): {low: string; high: string;} {
			const id = this.id;
			const storeValue = FormStore.get.metadataValue(id).values;

			const adapter = {
				get low(): string { return storeValue[0] || '' },
				set low(v: string) { FormStore.actions.filter({
					id,
					values: [v, adapter.high]
				});},

				get high(): string { return storeValue[1] || ''},
				set high(v: string) { FormStore.actions.filter({
					id,
					values: [adapter.low, v]
				});},
			};
			return adapter;
		},

		valueAdapterMultipleArray: {
			get(): string[] { return FormStore.get.metadataValue(this.id).values; },
			set(v: string[]) { FormStore.actions.filter({
				id: this.id,
				values: v
			});}
		},
	},
	methods: {
		autocompleteSelected(value: string) { this.valueAdapterSingle = value; }
	},
	watch: {
		options: {
			immediate: true,
			handler(options: Array<{value: string, label: string}>) {
				const newValues = {} as {[key:string]: boolean};
				options.forEach(opt => {
					newValues[opt.value] = this.valueAdapterMultipleArray.includes(opt.value)
				});
				this.valueAdapterMultipleMap = newValues;
			}
		},
		valueAdapterMultipleMap: {
			immediate: true,
			deep: true,
			handler(v: {[key: string]: boolean}) {
				FormStore.actions.filter({
					id: this.id,
					values: Object.entries(v).filter(([option, checked]) => checked).map(([option]) => option)
				})
			}
		}
	}
});
</script>

<style lang="scss">

.clear-button {
	margin-left: 20px;
	margin-top: 7px;
}

</style>