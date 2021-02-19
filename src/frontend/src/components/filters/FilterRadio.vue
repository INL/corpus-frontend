<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}} <Debug>(id: {{id}})</Debug></label>
		<div class="col-xs-12">
			<div class="radio" v-for="(option, index) in options" :key="index">
				<label :for="inputId+'_'+index"><input
					type="radio"
					:value="option.value"
					:name="inputId"
					:id="inputId+'_'+index"
					:checked="value === option.value"

					@click="changeValue($event, option.value) /* clear if clicked again */"
					@input.space="changeValue($event, option.value) /* clear if clicked again */"
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
		luceneQuery(): string|null {
			const value = this.value as string;
			return this.value ? `${this.id}:(${escapeLucene(this.value, false)})` : null;
		},
		luceneQuerySummary(): string|null {
			const value = this.value as string;
			return value ? this.optionsMap[value].label || value : null;
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>): string|null {
			const v = filterValues[this.id];
			return v ? v.values.map(unescapeLucene).find(val => this.optionsMap[val] != null) || null: null;
		},
		changeValue(event: Event, value: string) {
			const t = event.target as HTMLInputElement;
			this.e_input(t.checked ? value : undefined);
		}
	},
});
</script>

<style lang="scss">

</style>