<template>
	<div>
		<h3>{{title}}</h3>
		<!-- main annotation values -->
		<div style="display: flex; flex-direction: row; flex-wrap: wrap;">
			<ul v-for="a in stuff" :key="a.id" class="list-unstyled" style="padding: 0 5px;">
				<li><strong>{{a.id}}</strong></li>
				<li v-for="v in a.values" :key="v.value" :style="{outline: v.displayName === v.value ? '1px solid red' : undefined}">
					{{v.value}}

					<input type="text"
						:value="v.displayName"
						@change="displays[a.id][v.value] = $event.target.value"
					>
				</li>
			</ul>
		</div>
	</div>
</template>

<script lang="ts">
import { mapReduce } from '@/utils';
import cloneDeep from 'clone-deep';
import Vue from 'vue';

import {StepState} from './POS.vue';

export const value = 'Edit'
export const label = value;
export const title = 'Validate and add display values';
export const defaultAction = (s: StepState): StepState => s;

export const step = Vue.extend({
	props: {
		value: Object as () => StepState
	},
	data: () => ({
		title,

		displays: {} as {
			[annotationId: string]: {
				[value: string]: string
			}
		}
	}),
	computed: {
		stuff(): Array<{id: string, values: Array<{value: string, displayName: string}>}> {
			return Object.entries(this.displays).map(([a, values]) => ({
				id: a,
				values: Object.entries(values).map(([value, displayName]) => ({value, displayName}))
			}));
		}
	},
	created() {
		this.displays = cloneDeep(this.value.step4);

		const mainValues = Object.keys(this.value.step3.main!)
		const mainId = this.value.mainPosAnnotationId!;
		Vue.set(this.displays, mainId, this.displays[mainId] || mapReduce(mainValues, v => v));

		const subs = Object.values(this.value.step3.main!)[0].subs;

		// now create all missing entries
		Object.entries(subs)
		.forEach(([subId, subValues]) => {
			Vue.set(this.displays, subId, this.displays.subId || {});
			Object.entries(subValues).forEach(([value, {occurances}]) => {
				Vue.set(this.displays[subId], value, this.displays[subId][value] || value);
			});
		});
	},
	watch: {
		displays: {
			deep: true,
			handler() {
				this.$emit('input', {...this.value, step4: this.displays});
			}
		}
	}
});

export default step;

</script>