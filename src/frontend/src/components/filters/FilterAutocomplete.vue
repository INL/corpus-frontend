<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<input
				type="text"
				class="form-control"
				autocomplete="off"

				:id="inputId"
				:placeholder="displayName"
				:dir="textDirection"
				:value="value"

				@input="e_input"

				ref="autocomplete"
			/>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
// @ts-ignore
import Autocomplete from '@/mixins/autocomplete';

import { paths } from '@/api';
import { escapeLucene, MapOf, unescapeLucene } from '@/utils';
import { FilterValue } from '../../types/apptypes';

export default BaseFilter.extend({
	mixins: [Autocomplete],
	props: {
		value: {
			type: String,
			required: true,
			default: ''
		}
	},
	computed: {
		autocomplete(): boolean { return true; },
		autocompleteUrl(): string { return this.definition.metadata as string; },

		luceneQuery(): string|undefined {
			const value = this.value as string;
			if (!value || !value.trim()) {
				return undefined;
			}

			const resultParts = value
			.split(/"/)
			.flatMap((v, i) => {
				const inQuotes = (i % 2) !== 0;
				const containsWhitespace = v.match(/\s+/);
				return (inQuotes && containsWhitespace && v.length > 0) ? `"${v}"` : v.split(/\s+/).filter(s => !!s).map(escapeLucene);
			});

			return `${this.id}:(${resultParts.join(' ')})`;
		},

		luceneQuerySummary(): string|undefined {
			const value = this.value && this.value.trim() as string|undefined;
			return value ? `["${value.split(/"/).filter(v => !!v).join('", "')}"]` : undefined;
		},
	},
	methods: {
		autocompleteSelected(value: string) { this.e_input(value); },

		decodeInitialState(filterValues: MapOf<FilterValue>): string|undefined {
			const v = filterValues[this.id];
			return v && v.values.length ? v.values.map(unescapeLucene).join(' ') : undefined;
		}
	},
});
</script>

<style lang="scss">

</style>