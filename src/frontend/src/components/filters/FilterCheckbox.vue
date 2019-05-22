<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<div class="checkbox" v-for="(option, index) in options" :key="index">
				<!-- TODO optimize this, currently rewriting all values, ergo rerendering all checkboxes every time one changes -->
				<label :for="inputId+'_'+index" :title="option.title"><input
					type="checkbox"

					:value="option.value"
					:name="inputId+'_'+index"
					:id="inputId+'_'+index"

					:checked="value[option.value]"
					@change="toggleCheckbox(option.value, $event.target.checked);"
				> {{option.label || option.value}}</label>
			</div>
		</div>
	</div>
</template>


<script lang="ts">
import BaseFilter from '@/components/filters/Filter.vue';
import { FilterValue } from '@/types/apptypes';
import { Option } from '@/components/SelectPicker.vue';
import { MapOf, mapReduce } from '@/utils';

export default BaseFilter.extend({
	props: {
		value: {
			type: Object as () => {
				[value: string]: boolean;
			},
			required: true,
			default: {}
		}
	},
	computed: {
		options(): Option[] { return this.definition.metadata as Option[]; },
		optionsMap(): MapOf<Option> { return mapReduce(this.options, 'value'); },
		luceneQuery(): string|undefined {
			// Values for checkboxes are predetermined (i.e. user can't type in these fields)
			// So copy out the values without wildcard substitution or regex escaping.
			// Surround each individual values with quotes, and surround the total with brackets
			const selected = Object.entries(this.value)
				.filter(([value, isSelected]) => isSelected)
				.map(([value, isSelected]) => `"${value}"`);

			return selected.length ? `${this.id}:(${selected.join(' ')})` : undefined;
		},
		luceneQuerySummary(): string|undefined {
			const selected = Object.entries(this.value)
				.filter(([value, isSelected]) => isSelected)
				.map(([value, isSelected]) => value);

			return selected.length ? `["${selected.map(v => this.optionsMap[v].label || v).join('", "')}"]` : undefined;
		}
	},
	watch: {
		initialLuceneState: {
			immediate: true,
			handler(filters: FilterValue[]|undefined) {
				// Create model
				const model = this.options.reduce<{[v: string]: boolean;}>((values, opt) => {
					values[opt.value] = false;
					return values;
				}, {});

				// fill initial values
				const f = filters && filters.find(filter => filter.id === this.id);
				if (f) {
					f.values.filter(v => v in model).forEach(v => model[v] = true);
				}

				// will flow back through prop
				this.e_input(model);
			}
		},
	},
	methods: {
		toggleCheckbox(value: string, checked: boolean) {
			this.e_input({
				...this.value,
				[value]: checked
			});
		}
	},
});
</script>

<style lang="scss">

</style>