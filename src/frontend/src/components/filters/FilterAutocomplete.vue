<template>
	<div
		class="form-group filterfield"
		:id="id"
		:data-filterfield-type="definition.componentName"
	>
		<label class="col-xs-12" :for="inputId">{{displayName}} <Debug>(id: {{id}})</Debug></label>
		<div class="col-xs-12">
			<Autocomplete
				type="text"
				class="form-control"

				useQuoteAsWordBoundary

				:id="inputId"
				:placeholder="displayName"
				:dir="textDirection"

				:url="autocompleteUrl"
				v-model="modelvalue"
			/>
		</div>
	</div>
</template>

<script lang="ts">
import Autocomplete from '@/components/Autocomplete.vue';
import FilterText from '@/components/filters/FilterText.vue';

export default FilterText.extend({
	components: { Autocomplete },
	props: {
		value: {
			type: String,
			required: true,
			default: '',
		}
	},
	computed: {
		autocompleteUrl(): string { return this.definition.metadata as string; },
		modelvalue: {
			get(): string { return this.value; },
			set(v: string) { this.e_input(v); }
		}
	},
});
</script>

<style lang="scss">

</style>