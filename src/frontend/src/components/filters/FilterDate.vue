<template>
	<div
		class="form-group filterfield"
		:id="htmlId"
		:data-filterfield-type="definition.componentName"
	>
		<label v-if="showLabel" class="col-xs-12" :for="inputId">{{displayName}}</label>
		<Debug v-if="definition.metadata.field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.field}}])</label></Debug>
		<Debug v-else-if="definition.metadata.from_field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.from_field}} - {{definition.metadata.to_field}}])</label></Debug>

		<div style="display: flex; padding: 0 15px; width: 100%; flex-wrap: wrap;">
			<DatePicker 
				style="flex: none; margin-right: 15px;"

				opens="right"
				append-to-body
				show-dropdowns
				auto-apply
				:min-date="minDate"
				:max-date="maxDate"
				:locale-data="{ firstDay: 1, format: 'yyyy-mm-dd' }"
				:ranges="false"

				:date-range="valueComputed"
				:linked-calendars="false"

				@update="update({...value, ...$event, isDefaultValue: false})"
			/>
		
			<input type="text" class="form-control" placeholder="from" style="flex-basis: 0; flex-grow: 1; margin-right: 15px; min-width: 100px;" :value="valueComputed.startDate" @change="update({startDate: $event.target.value})"/>
			<input type="text" class="form-control" placeholder="to" style="flex-basis: 0; flex-grow: 1; min-width: 100px;" :value="valueComputed.endDate" @change="update({endDate: $event.target.value})"/>
		</div>
		
		<div class="btn-group col-xs-12" style="margin-top: 12px;" v-if="!definition.metadata.mode"> <!-- only when mode isn't locked -->
			<button v-for="mode in modes"
				type="button"
				:class="['btn btn-default', {'active': value.mode === mode.value}]"
				:key="mode.value"
				:value="mode.value"
				:title="mode.title"
				@click="e_input({...value, mode: mode.value})"
			>{{mode.label}}</button>
			<button v-if="!value.isDefaultValue" class="btn btn-default" type="button" @click="e_input(null)">reset</button>
		</div>
	</div>
</template>

<script lang="ts">
// @ts-ignore
import DatePicker from 'vue2-daterange-picker';

import BaseFilter from '@/components/filters/Filter';
import { Option } from '@/components/SelectPicker.vue';
import {FilterDateValue as Value, FilterDateMetadata as Metadata, dateToString} from './filterValueFunctions';

import 'vue2-daterange-picker/dist/vue2-daterange-picker.css'

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
				...(() => {
					const d = new Date();
					const s = dateToString(d);
					return {startDate: s, endDate: s}
				})(),
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
		maxDate(): string|undefined { return dateToString(this.metadata.max); },
		minDate(): string|undefined { return dateToString(this.metadata.min); },
		valueComputed(): Value {
			const r: Value&{isDefaultValue?: boolean} = {...this.value, }
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
	methods: {
		update(v: {startDate?: Date|string, endDate?: Date|string}) {
			const newState = {...this.value};
			// cannot always parse (when using is in the middle of editing, so see if we can)
			const startDate = dateToString(v.startDate);
			const endDate = dateToString(v.endDate);
			if (startDate) newState.startDate = startDate;
			if (endDate) newState.endDate = endDate;
			if (startDate || endDate) {
				delete newState.isDefaultValue;
				this.e_input(newState);
			}
		},
	}
});

</script>
