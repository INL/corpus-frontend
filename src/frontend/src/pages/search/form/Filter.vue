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

					v-model.lazy="value"
				/>
			</div>
		</template>
		<template v-else-if="uiType === 'range'">
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_lower'" placeholder="From" class="form-control" autocomplete="off" v-model="value.low">
			</div>
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_upper'" placeholder="To" class="form-control" autocomplete="off" v-model="value.high">
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

						v-model="value[option.value]"

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

						v-model="value"
						@click="$event.target.checked ? value = '' : undefined /* clear if clicked again */"
						@input.space="$event.target.checked ? value = '' : undefined /* clear if clicked again */"
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
					v-model="value"
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
		value: null as null| // uninitialized
			{[key: string]: boolean}| // checkbox
			string[]| // select
			string| // radio, combobox, text
			{low: string; high: string;} // range
	}),
	computed: {
		id(): string { return this.filter.id },
		displayName(): string { return this.filter.displayName },
		uiType(): CorpusStore.NormalizedMetadataField['uiType'] { return this.filter.uiType; },

		inputId(): string { return this.filter.id + '_value'; },

		options(): Option[] { return this.filter.values || []; },

		autocomplete(): boolean { return this.filter.uiType === 'combobox'; },
		autocompleteUrl(): string { return `${BLS_URL}/autocomplete/${this.filter.id}`},

		storeValue(): string[] { return FormStore.get.metadataValue(this.id).values; }
	},
	methods: {
		autocompleteSelected(value: string) { this.value = value; }
	},
	watch: {
		value: {
			// only trigger after we are initialized, so we don't write out initialization value
			immediate: false,
			deep: true,
			handler(values: any) {
				const uiType = this.uiType;
				const id = this.id;
				switch (this.uiType) {
					case 'text':
					case 'combobox':
					case 'radio': {
						FormStore.actions.filter({id, values: [values]});
						break;
					}
					case 'select': {
						FormStore.actions.filter({id, values});
						break;
					}
					case 'checkbox': {
						FormStore.actions.filter({
							id,
							values: Object.entries(values)
								.filter(([value, selected]) => selected)
								.map(([value, select]) => value)
						});
						break;
					}
					case 'range': {
						FormStore.actions.filter({id, values: [values.low, values.high]});
						break;
					}
					default: throw new Error('Unimplemented value handler for filter uiType ' + uiType);
				}
			}
		},
		storeValue: {
			immediate: true,
			handler(v: string[]) {
				// NOTE: we must deep-compare here to avoid infinite loops
				// of syncing with store -> sending new local value to store -> syncing with store -> etc...
				switch (this.uiType) {
					case 'text':
					case 'radio':
					case 'combobox': {
						// this.value = string
						if (this.value !== v[0]) {
							this.value = v[0] || '';
						}
						break;
					}
					case 'select': {
						// this.value = string[]
						if (!this.value || (this.value as any).length !== v.length || !(this.value as any).every((value: string) => v.includes(value))) {
							this.value = v.concat(); // don't alias!
						}
						break;
					}
					case 'checkbox': {
						// this.value = {[value: string]: boolean}
						const currentValues: string[] = this.value ?
							Object.entries(this.value as {[key:string]: boolean})
							.filter(([value, selected]) => selected)
							.map(([value, selected]) => value) : [];

						if (!this.value || currentValues.length !== v.length || !v.every(value => currentValues.includes(value))) {
							this.value = this.options.reduce((acc, o) => {
								acc[o.value] = v.includes(o.value);
								return acc;
							}, {} as {[key: string]: boolean})
						}
						debugger;

						break;
					}
					case 'range': {
						// this.value = {low: string; high: string;}
						if (!this.value || ((this.value as any).low != v[0] || (this.value as any).high != v[1])) {
							this.value = {
								low: v[0] || '',
								high: v[1] || ''
							}
						}
						break;
					}
					default: throw new Error('Unimplemented value handler for uiType ' + this.uiType);
				}
			}
		}
	},
	created() {

	}
});
</script>

<style lang="scss">

.clear-button {
	margin-left: 20px;
	margin-top: 7px;
}

</style>