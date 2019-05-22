<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="_componentTag"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-12">
			<input
				type="text"
				class="form-control"

				:id="inputId"
				:placeholder="displayName"
				:autocomplete="autocomplete"
				:dir="textDirection"
				:value="value"

				ref="autocomplete"

				@input="e_input"
			/>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter.vue';

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
				const inQuotes = (i % 2) !== 0;
				const containsWhitespace = v.match(/\s+/);
				return (inQuotes && containsWhitespace && v.length > 0) ? `"${v}"` : v.split(/\s+/).filter(s => !!s).map(escapeLucene);
			});

			return `${this.id}:(${resultParts.join(' ')})`;
		},
		luceneQuerySummary(): string|null {
			const value = this.value && this.value.trim() as string|undefined;
			return value ? `["${value.split(/"/).filter(v => !!v).join('", "')}"]` : null;
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>): string|undefined {
			const v = filterValues[this.id];
			return v ? v.values.map(s => s.match(/"/) ? s : unescapeLucene(s)).join(' ') || undefined : undefined;
		}
	}
});
</script>

<style lang="scss">

</style>