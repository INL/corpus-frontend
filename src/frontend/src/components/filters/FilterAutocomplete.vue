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

				@input="e_input($event.target.value)"

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
import { flatMap } from 'rxjs/operators';

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

		luceneQuery(): string|null {
			const value = this.value as string;
			if (!value || !value.trim()) {
				return null;
			}

			const resultParts = value
			.split(/"/)
			.flatMap((v, i) => {
				const inQuotes = (i % 2) !== 0;
				const containsWhitespace = v.match(/\s+/);
				return (inQuotes && containsWhitespace && v.length > 0) ? `"${v}"` : v.split(/\s+/).filter(s => !!s).map(escapeLucene);
			});

			return resultParts.length ? `${this.id}:(${resultParts.join(' ')})` : null;
		},

		luceneQuerySummary(): string|null {
			let surroundWithQuotes = false;

			const value = (this.value as string)
			.split(/"/)
			.flatMap((v, i) => {
				const inQuotes = (i % 2) !== 0;
				const containsWhitespace = !!v.match(/\s+/);
				if (inQuotes && containsWhitespace && v.length > 0) {
					surroundWithQuotes = true;
					return v;
				} else {
					return v.split(/\s+/).filter(vv => !!vv);
				}
			})
			return (value.length >= 2 || surroundWithQuotes) ? value.map(vv => `"${vv}"`).join(', ') : value.join(', ');
		},
	},
	methods: {
		autocompleteSelected(value: string) { this.e_input(value); },

		decodeInitialState(filterValues: MapOf<FilterValue>): string|null {
			const v = filterValues[this.id];
			return v && v.values.length ? v.values.map(unescapeLucene).join(' ') : null;
		}
	},
});
</script>

<style lang="scss">

</style>