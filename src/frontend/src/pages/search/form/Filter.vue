<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="(uiType !== 'select' && uiType !== 'radio' && uiType !== 'checkbox' && uiType !== 'range') ? inputId : undefined">{{displayName}}</label>

		<template v-if="uiType === 'select'">
			<div class="col-xs-12">
				<SelectPicker
					data-width="100%"
					multiple

					container="body"

					:placeholder="displayName"
					:id="inputId"
					:name="inputId"
					:options="options"

					v-model="value"
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
import * as FilterStore from '@/store/form/filters';


import SelectPicker, {Option} from '@/components/SelectPicker.vue';

//@ts-ignore
import Autocomplete from '@/mixins/autocomplete';

declare const BLS_URL: string;

type ValueAdapter =
null| // uninitialized
{[key: string]: boolean}| // checkbox
string[]| // select
string| // radio, combobox, text
{low: string; high: string;} // range

export default Vue.extend({
	mixins: [Autocomplete],
	components: {
		SelectPicker
	},
	props: {
		filter: Object as () => CorpusStore.NormalizedMetadataField,
	},
	data: () => ({
		value: null as ValueAdapter,
	}),
	computed: {
		id(): string { return this.filter.id },
		displayName(): string { return this.filter.displayName },
		uiType(): CorpusStore.NormalizedMetadataField['uiType'] { return this.filter.uiType; },

		inputId(): string { return this.filter.id + '_value'; },

		options(): Option[] { return this.filter.values || []; },

		autocomplete(): boolean { return this.filter.uiType === 'combobox'; },
		autocompleteUrl(): string { return `${BLS_URL}/autocomplete/${this.filter.id}`},

		storeValue(): string[] { return FilterStore.get.filterValue(this.id).values; }
	},
	methods: {
		autocompleteSelected(value: string) { this.value = value; },

		compareValues(ownValue: ValueAdapter, storeValue: string[]): boolean {
			const uiType = this.uiType;
			const id = this.id;
			if (ownValue == null) {
				return false;
			}

			switch (uiType) {
				case 'text':
				case 'radio':
				case 'combobox': {
					const v = ownValue as string;
					return storeValue.length === 1 && v === storeValue[0];
				}
				case 'select': {
					const v = ownValue as string[];
					return v.length === storeValue.length && v.every(s => storeValue.includes(s));
				}
				case 'checkbox': {
					const v = ownValue as { [value: string]: boolean };

					const currentValues: string[] = Object.entries(v)
						.filter(([value, selected]) => selected)
						.map(([value, selected]) => value);

					return currentValues.length === storeValue.length && currentValues.every(value => storeValue.includes(value));
				}
				case 'range': {
					const v = ownValue as {low: string; high: string;};
					return v.low === storeValue[0] && v.high === storeValue[1];
				}
				default: throw new Error('Unimplemented value comparator for uiType ' + this.uiType);
			}
		},
		syncWithStore(storeValue: string[]) {
			if (this.compareValues(this.value, storeValue)) {
				return;
			}

			switch (this.uiType) {
				case 'text':
				case 'radio':
				case 'combobox': {
					this.value = storeValue[0] || '';
					break;
				}
				case 'select': {
					this.value = storeValue.concat(); // don't alias!
					break;
				}
				case 'checkbox': {
					this.value = this.options.reduce((acc, o) => {
						acc[o.value] = storeValue.includes(o.value);
						return acc;
					}, {} as {[key: string]: boolean})
					break;
				}
				case 'range': {
					this.value = {
						low: storeValue[0] || '',
						high: storeValue[1] || ''
					}
					break;
				}
				default: throw new Error('Unimplemented value handler for uiType ' + this.uiType);
			}
		}
	},

	watch: {
		value: {
			// only trigger after we are initialized, so we don't write out initialization value
			immediate: false,
			deep: true,
			handler(ownValue: ValueAdapter) {
				// Not initialized yet, or already equal
				if (ownValue == null || this.compareValues(ownValue, this.storeValue)) {
					return;
				}

				const uiType = this.uiType;
				const id = this.id;
				switch (this.uiType) {
					case 'text':
					case 'combobox':
					case 'radio': {
						FilterStore.actions.filter({id, values: [ownValue as string]});
						break;
					}
					case 'select': {
						FilterStore.actions.filter({id, values: ownValue as string[] });
						break;
					}
					case 'checkbox': {
						FilterStore.actions.filter({
							id,
							values: Object.entries(ownValue as {[value: string]: boolean})
								.filter(([value, selected]) => selected)
								.map(([value, select]) => value)
						});
						break;
					}
					case 'range': {
						FilterStore.actions.filter({id, values: [(ownValue as any).low, (ownValue as any).high]});
						break;
					}
					default: throw new Error('Unimplemented value handler for filter uiType ' + uiType);
				}
			}
		},
		storeValue: {
			immediate: true,
			handler(v: string[]) {
				this.syncWithStore(v);
			}
		}
	},
});

</script>

<style lang="scss">

.clear-button {
	margin-left: 20px;
	margin-top: 7px;
}

</style>