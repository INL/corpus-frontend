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
		<template v-else-if="uiType === 'checkbox'">
			<div class="col-xs-12">
				 <div class="checkbox" v-for="(option, index) in options" :key="index">
					<!-- TODO optimize this, currently rewriting all values, ergo rerendering all checkboxes every time one changes -->
					<label :for="inputId+'_'+index"><input
						type="checkbox"
						:checked="value.includes(option.value)"
						:value="option.value"
						:name="inputId+'_'+index"
						:id="inputId+'_'+index"
						@change="value = $event.target.checked ? value.concat([option.value]) : value.filter(v => v !== option.value)"

					> {{option.label || option.value}}</label>
				</div>
			</div>
		</template>
		<template v-else-if="uiType === 'radio'">
			<div class="col-xs-12">
				 <div class="radio" v-for="(option, index) in options" :key="index">
					<!-- TODO optimize this, currently rewriting all values, ergo rerendering all checkboxes every time one changes -->
					<label :for="inputId+'_'+index"><input
						type="radio"
						:value="option.value"
						:name="inputId"
						:id="inputId+'_'+index"

						v-model="value[0]"
						@click="$event.target.checked ? value = [''] : undefined /* clear if clicked again */"
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
	computed: {
		id(): string { return this.filter.id },
		displayName(): string { return this.filter.displayName },
		uiType(): CorpusStore.NormalizedMetadataField['uiType'] { return this.filter.uiType; },

		inputId(): string { return this.filter.id + '_value'; },

		options(): Option[] { return this.filter.values || []; },

		autocomplete(): boolean { return this.filter.uiType === 'combobox'; },
		autocompleteUrl(): string { return `${BLS_URL}/autocomplete/${this.filter.id}`},


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
	methods: {
		autocompleteSelected(value: string) { this.value = [value]; }
	}
});
</script>

<style lang="scss">

.clear-button {
	margin-left: 20px;
	margin-top: 7px;
}

</style>