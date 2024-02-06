<template>
	<div class="groupby layout" style="position: relative;">
		<Tabs class="tabs selector" v-model="tab">
			<template #annotation v-if="isHits"><ul class="list-unstyled" style="overflow: auto; height: 300px;">
				<li v-for="{id, active} of annotations" :key="id">
					<button type="button" @click="annotation = id" class="btn-link" :class="{selected: id === annotation, active}">{{ id }}</button>
				</li>
			</ul></template>
			<template #metadata><ul class="list-unstyled" style="overflow: auto; height: 300px;">
				<li v-for="m of metadatas" :key="m">
					<button type="button" @click="metadata = m" class="btn-link" :class="{active: m === metadata}">{{ m }}</button>
				</li>
			</ul></template>

		</Tabs>

		<div class="content" style="position: relative;">
			<div style="height: 100%; display: inline-flex; align-items: center;">>></div>

			<Tabs v-if="tab === 'annotation' && annotation">
				<template #context><div class="annotation-context-select">
					<section class="text-muted">
						Select the part of the hit to group on
					</section>
					<div class="btn-group" style="display: flex; flex-wrap: nowrap;">
						<button v-for="{p, active} in positions" @click="setPosition(p)" :class="{btn: true, active}">{{ p }}</button>
					</div>
					<div class="hit-preview">
						<template v-for="section in preview">
							<template v-for="{word, active, title} in section"><span :title="title" :class="{'text-danger': active, active}">{{ word }}</span>&nbsp;</template>
							<span class="text-muted">||</span>&nbsp;
						</template>
						<!-- <span v-for="{word, active, title} in preview.hit" :title="title" :class="{'text-danger': active, active}">{{ word }}&nbsp;</span>
						<span v-for="{word, active, title} in preview.after" :title="title" :class="{'text-danger': active, active}">{{word }}&nbsp;</span> -->

						<!-- <span v-for="word in preview" :class="{}">{{ word }}&nbsp;</span> -->
					</div>
					<label><input :disabled="hitpart === 'wordleft' || hitpart === 'wordright'" type="radio" name="type" :value="false" v-model="context"> all words</label><br>
					<label><input :disabled="hitpart === 'wordleft' || hitpart === 'wordright'" type="radio" name="type" :value="true" v-model="context"> only some words</label>
					<Slider v-if="context && hitpart !== 'wordleft' && hitpart !== 'wordright'" ref="slider"
						:min="1"
						:max="contextsize"
						:data="Array.apply(null, {length: contextsize}).map((_, i) => ({value: i + 1, tooltip: i+1, label: `${i+1}\n${preview[hitpart][i]?.word || '[empty]'}`}))"
						v-model="range"
					/>

				</div></template>
				<template #capture><div class="annotation-capture-select">
					Group by a labeled capture:
					<SelectPicker :options="captures" v-model="capture"/>
					<br>
					<label><input type="checkbox" v-model="caseSensitive"> Case sensitive grouping</label>
				</div>

				</template>

			</Tabs>


			<button class="btn btn-primary" type="button" style="align-self: flex-end; justify-self: flex-end;" @click="apply">save</button>
		</div>
		<div>
			<div v-for="(a, i) in applied" :key="a.annotation?.annotation || a.metadata || a.annotation?.capture">
				<button type="button" @click="applied.splice(applied.indexOf(a), 1)">{{serialized[i]}} &times;</button>
			</div>
			<div>{{ serialized }}</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results/views';
import * as UIStore from '@/store/search/ui';

import SelectPicker, {OptGroup, Option} from '@/components/SelectPicker.vue';
import ContextGroup from '@/pages/search/results/groupby/ContextGroup.vue';
import { getAnnotationSubset, getMetadataSubset, serializeGroupBy } from '@/utils';
import debug from '@/utils/debug';

import * as GlobalSettingsStore from '@/store/search/results/global'

// @ts-ignore
import Slider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css'

import Tabs from './Tabs.vue';
import {isHitResults, BLSearchResult} from '@/types/blacklabtypes';
import { GroupByCaptureSettings, GroupByContextSettings, GroupByMetadataSettings, GroupBySettings } from '@/types/apptypes';

import {cast} from '@/utils';

import clonedeep from 'clone-deep';

const initialSettings = {
	annotation: cast<GroupByContextSettings>({
		annotation: CorpusStore.get.firstMainAnnotation().id,
		caseSensitive: false,
		position: 'H',
		start: 1,
		end: 1,
		type: 'annotation'
	}),
	metadata: cast<GroupByMetadataSettings>({
		type: 'metadata',
		field: '',
		caseSensitive: false
	}),
	capture: cast<GroupByCaptureSettings>({
		type: 'capture',
		annotation: CorpusStore.get.firstMainAnnotation().id,
		groupname: '',
		caseSensitive: false
	}),
}

export default Vue.extend({
	components: {
		SelectPicker,
		ContextGroup,
		Slider,
		Tabs
	},
	props: {
		type: String, // grouping hits or docs?
		disabled: Boolean,
		results: Object as () => BLSearchResult|undefined
	},
	data: () => ({
		tab: 'annotation' as 'annotation'|'metadata'|'capture',
		annotation: clonedeep(initialSettings.annotation),
		metadata: clonedeep(initialSettings.metadata),
		capture: clonedeep(initialSettings.capture),

		applied: [] as GroupBySettings[]
	}),
	methods: {
		apply() {
			this.applied.push(this[this.tab]);
			// @ts-ignore
			this[this.tab] = clonedeep(initialSettings[this.tab]);
		},
	},
	computed: {
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		isHits(): boolean { return isHitResults(this.results); },
		annotations(): Array<{id: string, active: boolean}> {
			return UIStore.getState().results.shared.groupAnnotationIds.map(id => ({
				id,
				active: this.applied.find(a => a.type === 'annotation' && a.annotation === id) !== undefined
			}));
		},
		metadatas(): string[] { return UIStore.getState().results.shared.groupMetadataIds },
		contextsize(): number { return GlobalSettingsStore.getState().wordsAroundHit ?? 5; },
		captures(): string[]|undefined {
			// TODO update types for blacklab 4
			if (!isHitResults(this.results)) return;
			const matchInfos = this.results?.hits?.[0]?.matchInfos;
			if (!matchInfos) return;

			return Object.entries(matchInfos).filter(([k, v]) => v.type === 'span').map(([k, v]) => k);
		},

		positions(): Array<{p: string, active: boolean}> {
			return [
				{p: 'before', active: this.annotation.position === 'L' && this.annotation.start === 1 && this.annotation.end === undefined},
				{p: 'before', active: this.annotation.position === 'L' && this.annotation.start === 1 && this.annotation.end === undefined},
				{p: 'before', active: this.annotation.position === 'L' && this.annotation.start === 1 && this.annotation.end === undefined},

				{p: 'H', active: this.annotation.position === 'H'},
				{p: 'R', active: this.annotation.position === 'R'}
			];
		},
		preview(): { before: Array<{active: boolean, word: string}>, hit: Array<{active: boolean, word: string}>, after: Array<{active: boolean, word: string}> } {
			const contextsize = this.contextsize;
			const firstHit = isHitResults(this.results) ? this.results.hits[0] : undefined;
			if (!firstHit || this.tab !== 'annotation') return { before: [], hit: [], after: [] };

			let {annotation, position, start, end} = this.annotation;
			if (!end) end = contextsize;

			const left = firstHit.left?.[annotation] || [];
			const right = firstHit.right?.[annotation] || [];
			const match = firstHit.match?.[annotation] || [];

			// todo from slider


			// we need to know which words are actually being used to group
			// for left context, the numbers are inverted, and for hit end, also.
			// that is L and E.

			// assume this is okay?
			// we need to transform those

			let wordstart: number =
				position === 'R' || position === 'H' ? start - 1 :
				contextsize - start;

			let wordend: number =
				position === 'L' || position === 'H' ? end - 1:
				contextsize - end + 1;


			return {
				before: left.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: i >= wordstart && i < wordend
				})),
				hit: match.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: i >= wordstart && i < wordend
				})),
				after: right.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: i >= wordstart && i < wordend
				}))
			}
		},
		serialized(): string[] {
			return this.applied.map(serializeGroupBy);
		}
	},
	watch: {
		serialized() {
			this.storeModule.actions.groupBy([]); // clear regular groupby
			this.storeModule.actions.groupByAdvanced(this.serialized); // apply advanced groupby
		}
	}

});
</script>

<style lang="scss">

.groupby {

	display: flex;
	flex-direction: row;
	max-width: 100%;
	overflow: auto;

	// the tabs + content
	.tabs.selector {
		display: inline-flex;
		flex-direction: column;
		border-right: 1px solid #ddd;
		flex-basis: auto;
		flex-grow: 0;
		flex-shrink: 0;

		// the tab selector
		.nav-item a {
			padding: 2px 3px;
		}

		// content wrapper
		.tab-content {
			padding: 0!important;
		}

		// list of buttons
		.btn-link{
			display: block;
			width: 100%;
			text-align: left;
			padding: 0 10px;
			&.selected {
				background-color: #eee;
			}
			&.active {
				font-weight: bold;
			}
		}
	}

	.content {
		display: flex;
		flex-grow: 1;

		padding: 10px;
		padding-top: 0;

	}
	.hit-preview {
		display: flex;
		flex-wrap: nowrap;

		.active {
			// red underline
			text-decoration: underline;
			text-decoration-color: red;
			text-decoration-style: solid;
			text-decoration-thickness: 2px;
			text-decoration-skip: none;
			text-decoration-skip-ink: none;
		}

	}




}

</style>