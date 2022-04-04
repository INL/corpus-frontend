<template>
	<div
		class="form-group filterfield"
		:id="htmlId"
		:data-filterfield-type="definition.componentName"
	>
		<label v-if="showLabel" class="col-xs-12" :for="inputId">{{displayName}}</label>
		<Debug v-if="definition.metadata.field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.field}}])</label></Debug>
		<Debug v-else-if="definition.metadata.from_field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.from_field}} - {{definition.metadata.to_field}}])</label></Debug>

		<DatePicker 
			style="padding-left: 15px; padding-right: 15px;"
			append-to-body
			show-dropdowns
			:min-date="minDate"
			:max-date="maxDate"
			
			:date-range="valueComputed"
			:linked-calendars="false"

			@update="e_input({...value, ...$event, isDefaultValue: false})"
		/>
		<div class="btn-group col-xs-12" style="margin-top: 12px;" v-if="!definition.metadata.mode"> <!-- only when mode isn't locked -->
			<button v-for="mode in modes"
				type="button"
				:class="['btn btn-default', {'active': value.mode === mode.value}]"
				:key="mode.value"
				:value="mode.value"
				:title="mode.title"
				@click="e_input({...value, mode: mode.value})"
			>{{mode.label}}</button>
		</div>
	</div>
</template>

<script lang="ts">
import BaseFilter from '@/components/filters/Filter';
import { Option } from '@/components/SelectPicker.vue';
// @ts-ignore
import DatePicker from 'vue2-daterange-picker';
import 'vue2-daterange-picker/dist/vue2-daterange-picker.css'
import {FilterDateValue as Value, FilterDateMetadata as Metadata} from './filterValueFunctions';

export const modes = {
	permissive: {
		id: 'permissive',
		operator: 'OR',
		displayName: 'Permissive',
		description: "Matches documents that are partially contained within the entered range"
	},

	strict: {
		id: 'strict',
		operator: 'AND',
		displayName: 'Strict',
		description: "Matches documents that are completely contained within the entered range"
	}
};

type Mode = keyof typeof modes;


export default BaseFilter.extend({
	components: {DatePicker},
	props: {
		value: {
			type: Object as () => Value,
			required: true,
			default: () => ({
				startDate: new Date(),
				endDate: new Date(),
				mode: 'strict',
				/** 
				 * props.definition.metadata can contain a default value.
				 * props.value is our actual value we pass to the calendar, on first setup this is undefined, so we set a default here in this object.
				 * 
				 * We want to apply the defaults from definition.metadata to our default value object, but we can't do that, 
				 * because we can't access the other props here (as the component hasn't been fully created yet).
				 *  
				 * So what we do: 
				 * Mark the default value with this boolean
				 * Instead of putting this into our calendar directly, pass it through computedValue() first
				 * There, see if we have this boolean, and if so, replace the two defaults defined above with those from defintion.metadata.
				 * 
				 * Then when the user interacts with the calender (i.e. overwrites the default value) this boolean will disappear, and the user dates will be used.
				 * Conveniently this system also lets us detect when only the strict/permissive toggle has been changed, but not the date.
				 */
				isDefaultValue: true
			}) as Value
		},
	},
	computed: {
		metadata(): Metadata {
			return this.definition.metadata || {
				field: this.id,
				range: false,
			}
		},
		maxDate(): Date|undefined {
			if (this.metadata.max) {
				const {max} = this.metadata;
				if (max instanceof Date) return max;
				const [_, y, m, d] = max.match(/([\d]{4})([\d]{2})([\d]{2})/)!;
				return new Date(+y,+m-1,+d);
			}
		},
		minDate(): Date|undefined {
			if (this.metadata.min) {
				const {min} = this.metadata;
				if (min instanceof Date) return min;
				const [_, y, m, d] = min.match(/([\d]{4})([\d]{2})([\d]{2})/)!;
				return new Date(+y,+m-1,+d);
			}
		},
		valueComputed(): {startDate: Date, endDate: Date, mode: 'strict'|'permissive', isDefaultValue?: boolean} {
			const r = {...this.value, }
			if (r.isDefaultValue) {
				if (this.minDate) r.startDate = this.minDate;
				if (this.maxDate) r.endDate = this.maxDate;
			}
			return r;
		},
		modes(): Option[] {
			return Object.values(modes).map(m => ({
				label: m.displayName,
				title: m.description,
				value: m.id
			}));
		},
	},
});

</script>
