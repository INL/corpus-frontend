<template>
	<div>
		<h3>{{title}}</h3>
		<!-- main annotation values -->
		<button type="button" @click="copy">copy</button>
		<button type="button" @click="download">download</button>
		<div>
			{{json}}
		</div>
	</div>
</template>

<script lang="ts">
import { Tagset } from '@/types/apptypes';
import { mapReduce } from '@/utils';
import cloneDeep from 'clone-deep';
import Vue from 'vue';
import {saveAs} from 'file-saver';

import {StepState} from './POS.vue';

export const value = 'Download'
export const label = value;
export const title = 'Download results';
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
		json(): Tagset {
			const t: Tagset = {
				values: {},
				subAnnotations: {}
			};

			const model = this.value.step3.main!;
			Object.entries(model).forEach(([mainValue, subAnnotations]) => {
				const valuesPerSubAnnotations: Array<{annotationId: string, values: string[]}> = Object.entries(subAnnotations.subs).map(([annotId, annotValues]) => {
					return {
						annotationId: annotId,
						values: Object.entries(annotValues).filter(([v, {occurances}]) => occurances > 0).map(([v]) => v),
					}
				});



				t.values[mainValue] = {
					value: mainValue,
					displayName: this.value.step4[this.value.mainPosAnnotationId!][mainValue],
					subAnnotationIds: valuesPerSubAnnotations.filter(sa => sa.values.length).map(sa => sa.annotationId),
				};
			});

			const mainPosValuesPerSubAnnotationValue: {
				[subAnnotId: string]: {
					[subAnnotValue: string]: string[] // mainposvalue[]
				}
			} = {}

			Object.entries(model).forEach(([mainValue, {subs}]) => Object.entries(subs).forEach(([subId, subValues]) => Object.entries(subValues).forEach(([subValue, {occurances}]) => {
				if (occurances > 0) {
					mainPosValuesPerSubAnnotationValue[subId] = mainPosValuesPerSubAnnotationValue[subId] || {};
					mainPosValuesPerSubAnnotationValue[subId][subValue] = mainPosValuesPerSubAnnotationValue[subId][subValue] || [];
					mainPosValuesPerSubAnnotationValue[subId][subValue].push(mainValue);
				}
			})))

			Object.entries(mainPosValuesPerSubAnnotationValue).forEach(([subAnnotId, subAnnotValues]) => {
				t.subAnnotations[subAnnotId] = {
					id: subAnnotId,
					values: Object.entries(subAnnotValues).map(([value, mainPosValues]) =>  ({
						value,
						displayName: this.value.step4[subAnnotId][value],
						pos: mainPosValues
					}))
				}
			});

			return t;
		}

	},
	methods: {
		download() {
			const fileName = 'tagset.json';
			const contents = JSON.stringify(this.json, undefined, 2);
			saveAs(new Blob([contents], {type: 'application/json'}), fileName);
		},
		copy() {
			const el: HTMLTextAreaElement = document.createElement('textarea');
			document.body.appendChild(el);
			el.style.display = 'none';

			const content = JSON.stringify(this.json, undefined, 2);
			el.value = content;
			el.select();
			el.setSelectionRange(0, content.length + 1);

			document.execCommand("copy");
		}
	}
});

export default step;

</script>