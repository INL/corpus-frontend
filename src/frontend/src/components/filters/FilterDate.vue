<template>
	<div
		class="form-group filterfield"
		:id="htmlId"
		:data-filterfield-type="definition.componentName"
	>
		<label v-if="showLabel" class="col-xs-12" :for="inputId">{{displayName}}</label>
		<Debug v-if="definition.metadata.field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.field}}])</label></Debug>
		<Debug v-else-if="definition.metadata.from_field"><label class="col-xs-12">(id: {{id}} [{{definition.metadata.from_field}} - {{definition.metadata.to_field}}])</label></Debug>

		<div style="margin: 0 15px;">
			<div class="dates">
				<label v-if="definition.metadata.range">From: </label>
				<input class="form-control" type="number" title="year" placeholder="year" v-model="yearFrom" :min="minYear" :max="maxYear"/>
				<input class="form-control" type="number" title="month" placeholder="month" v-model="monthFrom" min="1" max="12"/>
				<input class="form-control" type="number" title="day" placeholder="day" v-model="dayFrom" min="1" :max="startMonthLength"/>
			</div>
			<div v-if="definition.metadata.range" class="dates">
				<label v-if="definition.metadata.range">To: </label>
				<input class="form-control" type="number" title="year" placeholder="year" v-model="yearTo" :min="minYear" :max="maxYear"/>
				<input class="form-control" type="number" title="month" placeholder="month" v-model="monthTo" min="1" max="12"/>
				<input class="form-control" type="number" title="day" placeholder="day" v-model="dayTo" min="1" :max="endMonthLength"/>
			</div>
		</div>

		<div class="btn-group col-xs-12" v-if="!definition.metadata.mode && definition.metadata.range"> <!-- only when mode isn't locked, and when we're defining ranges -->
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
import BaseFilter from '@/components/filters/Filter';
import { Option } from '@/components/SelectPicker.vue';
import {FilterDateValue as Value, FilterDateMetadata as Metadata, FilterDateValue, dateToLuceneString} from './filterValueFunctions';

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

// we hebben 2 waardes: een startdate en enddate, beide als ymd strings.
// dan hebben we de filtervaluefunction en die zet het om in een waarde voor die andere meuk.

function dateToValue(date: Date): FilterDateValue['startDate'] {
	const y = date.getFullYear().toString().padStart(4, '0');
	const m = (date.getMonth() + 1).toString().padStart(2, '0');
	const d = date.getDate().toString().padStart(2, '0');
	return { y,m,d }
}

function normalizeBoundaryDate(date?: {y: string, m: string, d: string}|Date|string): FilterDateValue['startDate']|null {
	if (!date) return null;
	if (date instanceof Date) return dateToValue(date);
	if (typeof date === 'string') {
		const match = date.match(/([\d]{4})-?([\d]{2})-?([\d]{2})/);
		if (!match) return null;
		const [_, y, m, d] = match;
		return {y,m,d};
	}
	return date;
}

export default BaseFilter.extend({
	props: {
		value: {
			type: Object as () => FilterDateValue, //Value,
			required: true,
			default: () => ({
				...(() => {
					const d = new Date();
					const s = dateToValue(d);
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
		// we moeten zorgen dat de model die values bevat de we willen returnen, dat betekent dat we de defaults returnen zolang model isDefaultValue, en anders gewoon model.
		// of we moeten gewoon created() en dan de boel vervangen door de defaults..., doen we dat wel.

		model(): FilterDateValue {
			const v = this.value as FilterDateValue;
			// @ts-ignore
			if (v.isDefaultValue) { // replace with min and max when not set by the user (i.e. isDefaultValue)
				if (this.minDate) v.startDate = this.minDate;
				if (this.maxDate) v.endDate = this.maxDate;
			}
			return this.value;
		},
		metadata(): Metadata {
			return this.definition.metadata || {
				field: this.id,
				range: false,
			}
		},
		minDate(): FilterDateValue['startDate']|null { return normalizeBoundaryDate(this.metadata.min); },
		maxDate(): FilterDateValue['startDate']|null { return normalizeBoundaryDate(this.metadata.max); },
		minYear(): string|undefined { return this.minDate ? this.minDate.y : undefined; },
		maxYear(): string|undefined { return this.maxDate ? this.maxDate.y : undefined; },
		startMonthLength(): string { return dateToLuceneString({...this.model.startDate, d: ''}, 'end')!.substring(6, 8); },
		endMonthLength(): string { return dateToLuceneString({...this.model.endDate, d: ''}, 'end')!.substring(6, 8); },


		modes(): Option[] {
			return Object.values(modes).map(m => ({
				label: m.displayName,
				title: m.description,
				value: m.id
			}));
		},

		yearFrom: {
			get(): string { return this.model.startDate.y },
			set(y: string) { this.e_input({...this.model, startDate: {...this.model.startDate, y}, isDefaultValue: false})}
		},
		monthFrom: {
			get(): string { return this.model.startDate.m },
			set(m: string) { this.e_input({...this.model, startDate: {...this.model.startDate, m}, isDefaultValue: false})}
		},
		dayFrom: {
			get(): string { return this.model.startDate.d },
			set(d: string) { this.e_input({...this.model, startDate: {...this.model.startDate, d}, isDefaultValue: false})}
		},
		yearTo: {
			get(): string { return this.model.endDate.y },
			set(y: string) { this.e_input({...this.model, endDate: {...this.model.endDate, y}, isDefaultValue: false})}
		},
		monthTo: {
			get(): string { return this.model.endDate.m },
			set(m: string) { this.e_input({...this.model, endDate: {...this.model.endDate, m}, isDefaultValue: false})}
		},
		dayTo: {
			get(): string { return this.model.endDate.d },
			set(d: string) { this.e_input({...this.model, endDate: {...this.model.endDate, d}, isDefaultValue: false})}
		},
	},
});

</script>

<style lang="scss" scoped >
	.dates {
		display: flex;
		flex-wrap: nowrap;
		width: 100%;
		align-items: baseline;
		margin-bottom: 10px;
		> *:not(:last-child) { margin-right: 15px; }
		> label {
			flex-basis: 25%;
			min-width: auto;
		}
	}
</style>