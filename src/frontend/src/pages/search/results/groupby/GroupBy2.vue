<template>
	<div class="groupby layout">
		<section class="annotation">
			<h3>Linquistic Annotation</h3>
			<SelectPicker :options="annotations" v-model="annotation"/>
		</section>
		<section class="metadata">
			<h3>Document Metadata</h3>
			<SelectPicker :options="metadatas"/>
		</section>
		<section class="context" v-if="annotation">
			<h3>Part of snippet</h3>

			<div style="display: flex; flex-wrap: nowrap; flex-direction: row;">
				<div>
					<label>KWIC position: </label><br>
					<br>
					<label><input type="radio" name="type" value="full" v-model="contextType"> all words</label><br>
					<label><input type="radio" name="type" value="partial" v-model="contextType"> only some words</label>
				</div>

				<div v-for="pos in ['before', 'hit', 'after']" style="flex-basis: 0; flex-grow: 1;">
					<!-- todo rtl -->
					<div style="white-space: nowrap;">
						<button v-if="pos === 'after'" class="btn btn-default" style="padding-left: 0; padding-right: 0; writing-mode: vertical-lr; text-orientation: sideways;">first word</button><button
						 type="button" class="btn btn-default" :class="{active: pos === activePos}" style="width: 100%;" @click="activePos = pos">{{ pos }}</button><button
						 v-if="pos === 'before'">first word</button>
					</div>

					<div style="display: inline-block; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
						<span v-for="word in preview[pos]" :key="word">{{ word }}&nbsp;</span>
					</div>


					<Slider v-if="contextType === 'partial' && pos === activePos"
						class="groupby-editor-slider"

						:tooltip="'never'"
						:tooltip-dir="'bottom'"
						:speed="0"
						:min="1"
						:max="max"
						:width="/*'100px'*/'auto'"
						:reverse="sliderInverted"
						marks

						v-model="range"

						ref="slider"
					/>
				</div>

				<div v-if="subquerylabels" style="flex-basis: 0; flex-grow: 1;">

					<button type="button" class="btn btn-default" :class="{active: activePos === 'subquery'}" style="width: 100%;" @click="activePos = 'subquery'">subquery</button>
					<SelectPicker :disabled="activePos != 'subquery'" :options="subquerylabels" v-model="subquery"/>
				</div>
				<div v-else>no subqueries available</div>
			</div>

		</section>

		<button type="button" class="btn btn-primary" @click="apply">apply</button>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results/views';
import * as UIStore from '@/store/search/ui';

import SelectPicker, {OptGroup, Option} from '@/components/SelectPicker.vue';
import ContextGroup from '@/pages/search/results/groupby/ContextGroup.vue';
import { getAnnotationSubset, getMetadataSubset } from '@/utils';
import debug from '@/utils/debug';

import * as GlobalSettingsStore from '@/store/search/results/global'

// @ts-ignore
import Slider from 'vue-slider-component';


import {BLHitResults, BLDocResults, BLHitGroupResult, isHitResults, BLSearchResult} from '@/types/blacklabtypes';

export default Vue.extend({
	components: {
		SelectPicker,
		ContextGroup,
		Slider
	},
	props: {
		type: String, // grouping hits or docs?
		disabled: Boolean,
		results: Object as () => BLSearchResult|undefined
	},
	data: () => ({
		annotation: null as null|string,
		metadata: null as null|string,
		subquery: null as null|string,

		//slider
		sliderInverted: false,
		min: 1,
		range: [1, 5],

		contextType: 'full' as 'full'|'partial',
		activePos: 'hit' as 'before'|'hit'|'after'|'subquery',

	}),
	methods: {
		apply() {

		}
	},
	computed: {
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		annotations(): string[] { return CorpusStore.get.allAnnotations().map(a => a.id); },
		metadatas(): string[] { return CorpusStore.get.allMetadataFields().map(m => m.id); },
		subquerylabels(): string[]|undefined {
			// TODO update types for blacklab 4
			// @ts-ignore
			return this.results?.summary.pattern?.matchInfoNames
		},
		preview(): Record<string, string[]> {
			const annot = this.annotation;
			const firstHit = isHitResults(this.results) ? this.results.hits[0] : undefined;

			return (annot && firstHit) ? {
				before: firstHit.left?.[annot] ?? [],
				hit: firstHit.match[annot],
				after: firstHit.right?.[annot] ?? []
			} : {};
		},
		max(): number { return GlobalSettingsStore.getState().wordsAroundHit ?? 5; }
	},
	created() {
		this.annotation = this.annotations[0];
		this.metadata = this.metadatas[0];
	}
});
</script>

<style lang="scss" scoped>

.layout {
	display: grid;
	grid-template-areas:
		"annotation context"
		"metadata context";
	// first columns: 2 boxes below each other, second column: 1 box
}

.annotation {
	grid-area: annotation;
}
.metadata {
	grid-area: metadata;
}
.context {
	grid-area: context;
}

</style>