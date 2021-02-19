<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}} <Debug>(id: {{id}})</Debug></label>
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

import { escapeLucene, MapOf, splitIntoTerms, unescapeLucene } from '@/utils';
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
			return `${this.id}:(${splitIntoTerms(value, true).map(t => escapeLucene(t.value, !t.isQuoted)).join(' ')})`;
		},
		luceneQuerySummary(): string|null {
			let surroundWithQuotes = false;
			const split = splitIntoTerms(this.value, true);
			return split.map(t => (t.isQuoted ||split.length > 1) ? `"${t.value}"` : t.value).join(', ') || null;
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