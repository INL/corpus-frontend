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
import { flatMap } from 'rxjs/operators';

import { paths } from '@/api';
import { escapeLucene, MapOf, unescapeLucene } from '@/utils';
import { FilterValue } from '@/types/apptypes';

// @ts-ignore
import Autocomplete from '@/mixins/autocomplete';
import FilterText from '@/components/filters/FilterText.vue';

export default FilterText.extend({
	props: {
		value: {
			type: String,
			required: true,
			default: '',
		}
	},
	mixins: [Autocomplete],
	computed: {
		autocomplete(): boolean { return true; },
		autocompleteUrl(): string { return this.definition.metadata as string; },
	},
	methods: {
		autocompleteSelected(autocompletion: string) {
			const input = this.$refs.autocomplete as HTMLInputElement;
			const value = input.value;
			// @ts-ignore
			const {start, end}: {start: number; end: number;} = this._getWordAroundCursor();
			// alrighty, done?
			input.value = value.substring(0, start) + autocompletion + value.substring(end);
			input.selectionStart = start+autocompletion.length+1;
			input.selectionEnd = start+autocompletion.length+1;
			input.dispatchEvent(new Event('input'));
		},
	},
});
</script>

<style lang="scss">

</style>