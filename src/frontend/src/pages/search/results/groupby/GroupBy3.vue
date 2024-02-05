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
						<button type="button" @click="hitpart = 'before'" :class="{btn: true, active: hitpart === 'before'}">before</button>
						<button type="button" @click="hitpart = 'wordleft'" :class="{btn: true, active: hitpart === 'wordleft'}">wordleft</button>
						<button type="button" @click="hitpart = 'hit'" :class="{btn: true, active: hitpart === 'hit'}">hit</button>
						<button type="button" @click="hitpart = 'wordright'" :class="{btn: true, active: hitpart === 'wordright'}">wordright</button>
						<button type="button" @click="hitpart = 'after'" :class="{btn: true, active: hitpart === 'after'}">after</button>
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
import { getAnnotationSubset, getMetadataSubset } from '@/utils';
import debug from '@/utils/debug';

import * as GlobalSettingsStore from '@/store/search/results/global'

// @ts-ignore
import Slider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css'

import Tabs from './Tabs.vue';
import {BLHitResults, BLDocResults, BLHitGroupResult, isHitResults, BLSearchResult} from '@/types/blacklabtypes';

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
		annotation: undefined as undefined|string,
		metadata: undefined as undefined|string,
		capture: undefined as undefined|string,

		hitpart: 'hit' as 'hit'|'wordleft'|'wordright'|'before'|'after',
		// only group on part of the hit
		context: false,
		range: [0,1] as [number, number],
		tab: '',
		tab2: '',
		caseSensitive: false,

		applied: [] as Array<{
			annotation?: {
				hitpart: string,
				annotation: string,
				context?: [number, number],
				capture?: string,
			},
			metadata?: string,
			caseSensitive: boolean,
		}>
	}),
	methods: {
		apply() {
			const annotation = this.annotation;
			const metadata = this.metadata;
			const capture = this.capture;
			const hitpart = this.hitpart;
			const context = this.context;
			const range = this.range;
			const caseSensitive = this.caseSensitive;

			if (this.tab === 'metadata' && metadata)
				this.applied.push({metadata, caseSensitive});
			else if (this.tab === 'annotation' && annotation)
				this.applied.push({annotation: {hitpart, annotation, context: context ? range : undefined, capture}, caseSensitive});

			this.annotation = undefined;
			this.metadata = undefined;
			this.capture = undefined;
			this.hitpart = 'hit';
			this.context = false;
			this.range = [1, this.contextsize];
			this.caseSensitive = false;
		},
	},
	computed: {
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		isHits(): boolean { return isHitResults(this.results); },
		annotations(): Array<{id: string, active: boolean}> {
			return UIStore.getState().results.shared.groupAnnotationIds.map(id => ({
				id,
				active: this.applied.find(a => a.annotation?.annotation === id) !== undefined
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
		preview(): { before: Array<{active: boolean, word: string}>, hit: Array<{active: boolean, word: string}>, after: Array<{active: boolean, word: string}> } {
			const annot = this.annotation;
			const firstHit = isHitResults(this.results) ? this.results.hits[0] : undefined;
			if (!annot || !firstHit) return { before: [], hit: [], after: [] };

			const left = firstHit.left?.[annot] || [];
			const right = firstHit.right?.[annot] || [];
			const match = firstHit.match?.[annot] || [];

			// todo from slider
			const contextsize = this.contextsize;
			let wordstart: number = 0;
			let wordend: number = contextsize;

			if (this.hitpart === 'wordleft') {
				wordstart = contextsize - 1;
				wordend = contextsize;
			} else if (this.hitpart === 'wordright') {
				wordstart = 0;
				wordend = 1;
			} else if (this.context) {
				wordstart = this.range[0] - 1;
				wordend = this.range[1];
			}


			console.log('preview', {contextsize, context: this.context, wordstart, wordend, hitpart: this.hitpart})
			return {
				before: left.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: ['wordleft', 'before'].includes(this.hitpart) && wordstart <= i && wordend > i
				})),
				hit: match.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: ['hit'].includes(this.hitpart) && wordstart <= i && wordend > i
				})),
				after: right.map((w, i) => ({
					word: w.substring(0, 6) + (w.length > 6 ? '…' : '') || '[empty]',
					title: w,
					active: ['wordright', 'after'].includes(this.hitpart) && wordstart <= i && wordend > i
				}))
			}

			// const hit = firstHit;
			// const hitpart = this.hitpart;
			// const readFrom = ((hitpart === 'before' || hitpart === 'wordleft') ? hit.left : this.hitpart === 'hit' ? hit.match : hit.right)?.[annot] || [];

			// const first = hitpart === 'wordleft' ? readFrom.length - 1 : 0;
			// const last = hitpart === 'wordright' ? 1 : readFrom.length;
			// return readFrom.slice(first, last);

		},
		serialized(): string[] {
			return this.applied.map(a => {
				if (a.metadata) return `field:${a.metadata}:${a.caseSensitive ? 's' : 'i'}`;
				if (a.annotation) {
					if (a.annotation.capture) return `capture:${a.annotation.annotation}:${a.caseSensitive ? 's' : 'i'}:${a.annotation.capture}`
					if (a.annotation.context) {
							/**
							 * Context has a letter preceding the indices, to indicate whether to apply to context before the hit, the hit itself, or the context after the hit.
							 * The list is as follows:
							 * before: L (left)
							 * hit: H (hit) or E (from end of hit)
							 * after: R (right)
							 *
							 * After the letter are the numbers indicating the range of words to include. in the format of `L1-5` or `H1-5` or `E1-5` or `R1-5` etc.
							 * if only a single index is to be included, a single number will do.
							*/
							const contextLetter =
								// TODO from end of hit, and declare type for hitpart in state.
								a.annotation.hitpart === 'before' ? 'L' :
								a.annotation.hitpart === 'hit' ? 'H' :
								/*a.annotation.hitpart === 'after' ? */ 'R';
							return `context:${a.annotation.annotation}:${a.caseSensitive ? 's' : 'i'}:${contextLetter}${a.annotation.context[0]}-${a.annotation.context[1]}`;
					}

					return `${a.annotation.hitpart}:${a.annotation.annotation}:${a.caseSensitive ? 's' : 'i'}`
				}
				// never
				return '';
			})
		}

	},
	created() {
		this.annotation = this.annotations[0].id;
		this.metadata = this.metadatas[0];
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