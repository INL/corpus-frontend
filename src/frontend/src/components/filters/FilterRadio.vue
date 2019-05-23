<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<div class="radio" v-for="(option, index) in options" :key="index">
				<label :for="inputId+'_'+index"><input
					type="radio"
					:value="option.value"
					:name="inputId"
					:id="inputId+'_'+index"
					:checked="value === option.value"

					@click="e_input($event.target.checked ? '' : option.value) /* clear if clicked again */"
					@input.space="e_input($event.target.checked ? '' : option.value) /* clear if clicked again */"
				> {{option.label || option.value}}</label>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
import { FilterValue } from '@/types/apptypes';
import { Option } from '@/components/SelectPicker.vue';
import { MapOf, mapReduce, unescapeLucene, escapeLucene } from '@/utils';

export default BaseFilter.extend({
	props: {
		value: {
			type: String,
			required: true,
			default: ''
		}
	},
	computed: {
		options(): Option[] { return this.definition.metadata as Option[]; },
		optionsMap(): MapOf<Option> { return mapReduce(this.options, 'value'); },
		luceneQuery(): string|undefined {
			const value = this.value as string;
			return this.value ? `${this.id}:(${escapeLucene(this.value)})` : undefined;
		},
		luceneQuerySummary(): string|undefined {
			const value = this.value as string;
			return value ? this.optionsMap[value].label || value : undefined;
		}
	},
	methods: {
		toggleCheckbox(value: string, checked: boolean) {
			this.e_input({
				...this.value,
				[value]: checked
			});
		},

		decodeInitialState(filterValues: MapOf<FilterValue>): string|undefined {
			const v = filterValues[this.id];
			return v ? v.values.map(unescapeLucene).find(val => this.optionsMap[val] != null) : undefined;
		}
	},
});
</script>

<style lang="scss">

</style>