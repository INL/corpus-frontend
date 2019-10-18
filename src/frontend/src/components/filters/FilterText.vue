<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}} <Debug>({{id}})</Debug></label>
		<div class="col-xs-12">
			<input
				type="text"
				class="form-control"

				:id="inputId"
				:placeholder="displayName"
				:dir="textDirection"
				:value="value"

				@input="e_input($event.target.value)"
			/>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';

import { escapeLucene, MapOf, unescapeLucene } from '@/utils';
import { FilterValue } from '@/types/apptypes';

export default BaseFilter.extend({
	props: {
		value: {
			type: String,
			required: true,
			default: ''
		}
	},
	computed: {
		luceneQuery(): string|null {
			const value = this.value as string;
			if (!value || !value.trim()) {
				return null;
			}

			const resultParts = value
			.split(/"/)
			.flatMap((v, i) => {
				if (!v) {
					return [];
				}
				const inQuotes = (i % 2) !== 0;
				const containsWhitespace = v.match(/\s+/);

				return inQuotes ? escapeLucene(v, false) : v.split(/\s+/).filter(s => !!s).map(val => escapeLucene(val, true));
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
			});
			return (value.length >= 2 || surroundWithQuotes) ? value.map(vv => `"${vv}"`).join(', ') : value.join(', ');
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>): string|null {
			const v = filterValues[this.id];
			return v ? v.values.map(unescapeLucene).map(val => val.match(/\s+/) ? `"${val}"` : val).join(' ') || null : null;
		}
	}
});
</script>

<style lang="scss">

</style>