<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="uiType"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}}</label>
		<div class="col-xs-4">
			<input type="text" :id="inputId+'_lower'" placeholder="From" class="form-control" autocomplete="off" :value="value.low" @input="e_input({low: $event.target.value, high})">
		</div>
		<div class="col-xs-4">
			<input type="text" :id="inputId+'_upper'" placeholder="To" class="form-control" autocomplete="off" :value="value.high" @input="e_input({low, high: $event.target.value})">
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter.vue';
import { FilterValue } from '../../types/apptypes';

export default BaseFilter.extend({
	props: {
		value: {
			type: Object as () => {
				low: string,
				high: string
			},
			required: true,
			default: {
				low: '',
				high: ''
			}
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
	watch: {
		initialLuceneState: {
			immediate: true,
			handler(filters: FilterValue[]|undefined) {
				if (!filters || !filters.length) {
					this.e_input(undefined);
					return;
				}

				const v = filters.find(f => f.id === this.id);
				if (!v || !(v.values.length === 2)) {
					this.e_input(undefined);
					return;
				}

				this.e_input({
					low: v.values[0] !== '0' ? v.values[0] : '',
					high: v.values[1] !== '9999' ? v.values[1] : ''
				});
			}
		}
	},
});
</script>

<style lang="scss">

</style>