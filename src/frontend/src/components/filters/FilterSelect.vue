<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<SelectPicker
				data-width="100%"
				multiple

				container="body"

				:data-id="inputId"
				:data-name="inputId"
				:dir="textDirection"
				:placeholder="displayName"
				:options="options"

				v-model="value"
			/>
		</div>
	</div>
</template>


<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
import SelectPicker, { Option } from '@/components/SelectPicker.vue';
import { FilterValue } from '@/types/apptypes';
import { MapOf, mapReduce, unescapeLucene, escapeLucene } from '@/utils';

export default BaseFilter.extend({
	components: {
		SelectPicker
	},
	props: {
		value: {
			type: Array as () => string[],
			required: true,
			default: () => []
		},
	},
	computed: {
		options(): Option[] { return this.definition.metadata as Option[]; },
		optionsMap(): MapOf<Option> { return mapReduce(this.options, 'value'); },
		luceneQuery(): string|undefined {
			const value = this.value as string[];
			return value.length ? `${this.id}:(${value.map(escapeLucene).join(' ')})` : undefined;
		},
		// use option displaynames in the summary
		luceneQuerySummary(): string|undefined {
			const value = this.value as string[];
			return value.length ? `["${value.map(v => this.optionsMap[v].label || v).join('", "')}"]` : undefined;
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>): string[]|undefined {
			const v = filterValues[this.id];
			const values = v ? v.values.map(unescapeLucene).filter(val => this.optionsMap[val] != null) : [];
			return values.length ? values : undefined;
		}
	},
});
</script>

<style lang="scss">

</style>