<template>
	<div
		class="form-group filterfield"
		:id="htmlId"
		:data-filterfield-type="definition.componentName"
	>
		<label v-if="showLabel" class="col-xs-12" :for="inputId">{{displayName}} <Debug>(id: {{id}})</Debug></label>
		<Debug v-else><label class="col-xs-12">(id: {{id}})</label></Debug>
		<div class="col-xs-12">
			<div class="radio" v-for="(option, index) in options" :key="index">
				<label :for="inputId+'_'+index"><input
					type="radio"
					:value="option.value"
					:name="inputId"
					:id="inputId+'_'+index"
					:checked="value === option.value"

					@click="changeValue($event, option.value) /* clear if clicked again */"
					@input.space="changeValue($event, option.value) /* clear if clicked again */"
				> {{option.label || option.value}}</label>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
import { Option } from '@/components/SelectPicker.vue';

export default BaseFilter.extend({
	props: {
		value: {
			type: String,
			required: true,
			default: ''
		}
	},
	computed: {
		options(): Option[] { return this.definition.metadata as Option[]; },
	},
	methods: {
		changeValue(event: Event, value: string) {
			const t = event.target as HTMLInputElement;
			this.e_input(t.checked ? value : undefined);
		}
	},
});

</script>
