<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="_componentTag"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-4">
			<input type="text"
				placeholder="From"
				class="form-control"
				autocomplete="off"

				:id="inputId+'_lower'"
				:value="value.low"

				@input="e_input({low: $event.target.value, high})"
			>
		</div>
		<div class="col-xs-4">
			<input type="text"
				placeholder="To"
				class="form-control"
				autocomplete="off"

				:id="inputId+'_upper'"
				:value="value.high"

				@input="e_input({low, high: $event.target.value})"
			>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter.vue';
import { FilterValue } from '@/types/apptypes';
import { MapOf } from '@/utils';

export default BaseFilter.extend({
	props: {
		value: {
			type: Object as () => {
				low: string,
				high: string
			},
			required: true,
			default: () => ({
				high: '',
				low: ''
			})
		}
	},
	computed: {
		luceneQuery(): string|undefined {
			return (this.value.low || this.value.high) ?
				`${this.id}:[${this.value.low || '0'} TO ${this.value.high || '9999'}]` :
				undefined;
		},
		luceneQuerySummary(): string|undefined {
			return this.luceneQuery ? `[${this.value.low} TO ${this.value.high}]` : undefined;
		}
	},
	methods: {
		decodeInitialState(filterValues: MapOf<FilterValue>): { low: string; high: string; }|undefined {
			const v = filterValues[this.id];
			if (!v || !v.values.length) {
				return undefined;
			}
			return {
				low: v.values[0] !== '0' ? v.values[0] || '' : '',
				high: v.values[1] !== '9999' ? v.values[1] || '' : '',
			};
		}
	}
});
</script>

<style lang="scss">

</style>