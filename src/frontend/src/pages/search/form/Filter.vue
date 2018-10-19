<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>

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

					v-model="value"
				/>
			</div>
		</template>
		<template v-else-if="uiType === 'range'">
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_lower'" placeholder="From" class="form-control" autocomplete="off" v-model="value[0]">
			</div>
			<div class="col-xs-4">
				<input type="text" :id="inputId+'_upper'" placeholder="To" class="form-control" autocomplete="off" v-model="value[1]">
			</div>
		</template>
		<template v-else>
			<div class="col-xs-12">
				<input
					type="text"
					class="form-control"

					:id="inputId"
					:placeholder="displayName"
					:autocomplete="serverAutocompleteUrl ? 'off' : undefined"
					:data-autocomplete="serverAutocompleteUrl"

					v-model="value[0]"
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

export default Vue.extend({
	components: {
		SelectPicker
	},
	props: {
		filter: Object as () => CorpusStore.NormalizedMetadataField,
	},
	computed: {
		id(): string { return this.filter.id },
		displayName(): string { return this.filter.displayName },
		uiType(): string { return this.filter.uiType; },

		inputId(): string { return this.filter.id + '_value'; },

		options(): Option[] { return this.filter.values || []; },

		serverAutocompleteUrl(): string|undefined {
			// TODO move to api?
			return this.filter.uiType === 'combobox' ? this.filter.id : undefined;
		},

		value: {
			get(): string[] {
				return FormStore.get.metadataValue(this.id).values;
			},
			set(values: string[]): void {
				return FormStore.actions.filter({
					id: this.id,
					values
				});
			}
		}
	},

	// beforeMount() {
	// 	switch (this.filter.uiType ) {
	// 		case 'range': this.value = ['','']; break;
	// 		case 'combobox': this.value = []; break;
	// 		case 'select': this.value = []; break;
	// 		default: this.value = [''];
	// 	}
	// }
});
</script>

<style lang="scss">

</style>