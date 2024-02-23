<template>


	<div style="display: flex; flex-direction: row; padding-top: 25px;">
		<div style="display: flex; flex-direction: column; border: 1px solid #CCC;">
			<div class="btn-group" style="display: flex; width: 100%;">
				<button type="button" @click="addAnnotation" style="flex-basis: 0; flex-grow: 1; min-width: 50%; border-radius: 0;" class="btn btn-success" v-if="type === 'hits'">+ Annotation</button>
				<button type="button" @click="addMetadata" style="flex-basis: 0; flex-grow: 1; min-width: 50%; border-radius: 0;" class="btn btn-primary">+ Metadata</button>
			</div>

			<!-- list of current groups -->
			<div style="display: flex; flex-wrap: nowrap;" v-for="(a, i) in localModel">
				<button
					type="button"
					:key="i"
					style="text-align: left; border-radius: 0; border-right: 0; border-left: 0; flex-grow: 1;"
					:class="['btn btn-default', currentIndex === i ? 'active' : '']"
					@click="currentIndex = i;"
				>
					<span class="text-primary" style="font-family: monospace;">[{{ a.type.substring(0, 1).toUpperCase() }}]</span> {{humanizeGroupBy(a)}}
					<span v-if="!isValidGroup(a)" class="fa fas fa-warning text-danger" title="This grouping is not valid."></span>
				</button>
				<button type="button" class="btn btn-danger" style="flex: 0; border-left: 0; border-radius: 0; padding-right: 4px; padding-left: 4px;" @click="removeGroup(i)">&times;</button>
			</div>


			<template v-if="localModel.length">
				<div style="flex-grow: 1; min-height: 50px;">
					<!-- placeholder -->
				</div>

				<div class="btn-group" style="border: 0;">
					<button class="btn btn-danger" style="min-width: 50%; border-radius: 0; border-left: 0;" @click="clear">clear</button>
					<button class="btn btn-primary" style="margin: 0; min-width: 50%; border-radius: 0; border-right: 0;" @click="apply">apply</button>
				</div>
			</template>
		</div>

		<div style="flex-grow: 1; border: 1px solid #ccc; border-left: 0; padding: 10px 15px; min-width: 0;">
			<template v-if="current">
				<button type="button" class="btn btn-link pull-right" @click="removeGroup(currentIndex)">&times;</button>

				<template v-if="current.type === 'annotation'">
					<section class="text-muted col-m-6">
						Select the annotation to group on.<br>
						<SelectPicker placeholder="Annotation" hideEmpty searchable v-model="current.annotation" :options="annotations2" v-if="current.type === 'annotation'"/>
						<!-- :options="annotations.map(a => a.id)"  -->
					</section>
					<label><input type="checkbox" v-model="current.caseSensitive"> Case sensitive</label>
					<hr>

					<section class="text-muted">
						Select the part of the hit to group on

						<div class="btn-group" style="display: flex; flex-wrap: nowrap;">
							<button type="button" @click="current.position = 'L'" class="btn btn-default" :class="{active: current.position === 'L'}">before</button>
							<button type="button" @click="current.position !== 'H' && current.position !== 'E' ? current.position = 'H' : void 0" class="btn btn-default" :class="{active: current.position === 'H' || current.position === 'E'}">hit</button>
							<button type="button" @click="current.position = 'R'" class="btn btn-default" :class="{active: current.position === 'R'}">after</button>
							<button type="button" @click="current.position = undefined" class="btn btn-default" :class="{active: current.position == null}">capture group</button>
						</div>
					</section>

					<template v-if="current.position">
						<!-- if position disabled, use capture labels, no preview to render, and selecting which words is not possible -->
						<div class="hit-preview">
							<template v-for="(section, i) of preview">
								<span v-if="i !== 0" class="text-muted separator">||</span>
								<component v-for="({word, active, title}, j) of section" :key="word + i + '_' + j " :is="active ? 'b' : 'span'" :title="title" :class="{'word': true, 'text-primary': active, active}">{{ word }}</component>
							</template>
						</div>

						<label><input type="radio" name="type" value="first" v-model="context"> first word</label><br>
						<label><input type="radio" name="type" value="all" v-model="context"> all words</label><br>
						<label><input type="radio" name="type" value="context" v-model="context"> specific words</label>
						<Slider v-if="context === 'context'"
						inline
							:min="1"
							:max="contextsize"
							:data="contextSliderPreview"
							v-model="contextRange"
						/>
					</template>
					<div v-else>
						Group by a labeled capture:
						<SelectPicker :options="captures" v-model="current.groupname" container="body" allowUnknownValues/>
						<br>
					</div>

				</template>
				<template v-else>
					<section class="text-muted">
						Select the document metadata to group on.<br>
						<SelectPicker placeholder="Metadata" hideEmpty v-model="current.field" :options="metadatas.map(a => a.id)" v-if="current.type === 'metadata'"/>
					</section>
					<label><input type="checkbox" v-model="current.caseSensitive"> Case sensitive</label>
				</template>
			</template>
			<h4 v-else class="text-secondary">In this window you can apply grouping to the results. Click the Annotation or Metadata buttons on the left to get started.</h4>
		</div>
		<div v-if="viewGroup" style="color: #888; font-size: 85%;">
			<button type="button" class="btn btn-sm btn-primary" :disabled="disabled" @click="$emit('viewgroupLeave')"><span class="fa fa-angle-double-right"></span> Go back to grouped view</button>
		</div>

	</div>
</template>

<script lang="ts">
import Vue from 'vue';

// import * as CorpusStore from '@/store/search/corpus';
import * as ResultsStore from '@/store/search/results/views';
import * as UIStore from '@/store/search/ui';

import SelectPicker from '@/components/SelectPicker.vue';
import { GroupBySettings2, getAnnotationSubset, parseGroupBy2, serializeGroupBy2 } from '@/utils';

import * as GlobalSettingsStore from '@/store/search/results/global'
import * as CorpusStore from '@/store/search/corpus';

import debug from '@/utils/debug';

// @ts-ignore
import Slider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css'

import {isHitResults, BLSearchResult, BLSearchParameters, BLHitResults} from '@/types/blacklabtypes';

import cloneDeep from 'clone-deep';

import * as SearchModule from '@/store/search/index';
import { blacklab } from '@/api';
import jsonStableStringify from 'json-stable-stringify';

const initialGroupBySettings: GroupBySettings2 = {
	type: 'annotation' as  'annotation'|'metadata',
	annotation: '',
	caseSensitive: false,
	/** when undefined, use groupname instead of positional, and ignore start+end */
	position: 'H' as 'L'|'H'|'R'|'E'|undefined,
	start: 1,
	end: 1 as number|undefined,
	field: '',
	groupname: '',
}

export default Vue.extend({
	components: {
		SelectPicker,
		Slider,
	},
	props: {
		type: String, // grouping hits or docs?
		disabled: Boolean,
		results: Object as () => BLSearchResult|undefined
	},
	data: () => ({

		display: 'advanced' as 'advanced'|'simple',

		// tab: 'annotation' as 'annotation'|'metadata',
		// annotation: clonedeep(initialSettings.annotation),
		// metadata: clonedeep(initialSettings.metadata),
		// capture: clonedeep(initialSettings.capture),
		forceContext: false,

		/** index into localModel that is displayed in the UI */
		currentIndex: 0,
		/** micro optimization: whether to skip next parse since the new value came from us anyway. */
		localModelUpToDate: false,
		localModel: [] as GroupBySettings2[],

		hits: undefined as undefined|BLHitResults
	}),
	computed: {
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		storeValue(): string[] { return this.storeModule.getState().groupBy.concat(this.storeModule.getState().groupByAdvanced); },
		viewGroup(): string|null { return this.storeModule.getState().viewGroup; },
		current(): GroupBySettings2|undefined { return this.localModel[this.currentIndex]; },
		firstHitPreviewQuery(): BLSearchParameters|undefined {
			const params = SearchModule.get.blacklabParameters();
			if (!params) return undefined;
			if (!params.viewgroup)
				delete params.group;
			delete params.includetokencount;
			delete params.listvalues;
			params.listmetadatavalues = '__nothing__';
			params.first = 0;
			params.number = 1;
			params.waitfortotal = false;
			return params;
		},
		firstHitPreviewQueryHash(): string {
			return jsonStableStringify(this.firstHitPreviewQuery);
		},


		isHits(): boolean { return isHitResults(this.results); },
		annotations(): Array<{id: string, active: boolean}> {
			return UIStore.getState().results.shared.groupAnnotationIds.map(id => ({
				id,
				active: this.localModel.find(a => a.type === 'annotation' && a.annotation === id) !== undefined
			}));
		},
		annotations2(): any[] {
			return getAnnotationSubset(
				UIStore.getState().results.shared.groupAnnotationIds,
				CorpusStore.get.annotationGroups(),
				CorpusStore.get.allAnnotationsMap(),
				'Search',
				CorpusStore.get.textDirection(),
				debug.debug, // is debug enabled - i.e. show debug labels in dropdown
				UIStore.getState().dropdowns.groupBy.annotationGroupLabelsVisible
			).map(group => ({label: group.label, title: group.title, options: group.options}))
		},
		metadatas(): Array<{id: string, active: boolean}> {
			return UIStore.getState().results.shared.groupMetadataIds.map(id => ({
				id,
				active: this.localModel.find(a => a.type === 'metadata' && a.field === id) !== undefined
			}))
		},
		contextsize(): number { return GlobalSettingsStore.getState().wordsAroundHit ?? 5; },
		captures(): string[]|undefined {
			// TODO update types for blacklab 4
			// @ts-ignore
			const mi: BLMatchInfos = this.hits?.summary?.pattern?.matchInfos;
			// @ts-ignore
			return Object.entries(mi|| {}).filter(([k, v]) => v.type === 'span').map(([k,v]) => k)
		},

		preview(): {active: boolean, word: string, title: string}[][] {
			if (!this.current) return [];

			/** Shorten the string, accounting for the ellipsis we add at the end */
			function shorten(w: string, maxLengthIncludingEllipsis = 8) {
				if (w.length > maxLengthIncludingEllipsis)
					return w.substring(0, maxLengthIncludingEllipsis - 3) + '…';
				return w;
			}
			if (this.current.type !== 'annotation' || !this.current.annotation || !isHitResults(this.hits) || !this.hits.hits.length)
				return [];

			const firstHit = this.hits.hits[0];
			const {annotation, position, start, end} = this.current;

			const left = firstHit.left?.[annotation] || [];
			const right = firstHit.right?.[annotation] || [];
			const match = firstHit.match?.[annotation] || [];

			const startindex: number = start - 1; // correct for 1-indexed vs 0-indexed
			const endindex: number = end ?? Number.MAX_SAFE_INTEGER; // if end is not set, use entire context.

			// left/before context ('L') and hit-from-end context ('E') use inverted index in BlackLab, mimic this.
			const leftstart = left.length - endindex; // inclusive
			const leftend = left.length - startindex; // exclusive

			return [
				left.map((w, i) => ({
					word: shorten(w) || '[]',
					title: w,
					active: position === 'L' && i >= leftstart && i < leftend
				})),
				match.map((w, i) => ({
					word: shorten(w) || '[]',
					title: w,
					active:
						position === 'H' ? i >= startindex && i < endindex :
						position === 'E' ? i >= leftstart && i < leftend :
						false
				})),
				right.map((w, i) => ({
					word: shorten(w) || '[]',
					title: w,
					active: position === 'R' && i >= startindex && i < endindex
				}))
			];
		},
		context: {
			get(): 'first'|'all'|'context' {
				if (!this.current) return 'context';

				if (this.forceContext) return 'context';
				if (this.current.end == null) return 'all';
				if (this.current.start === 1 && this.current.end === 1) return 'first';
				return 'context';
			},
			set(v: 'first'|'all'|'context') {
				if (!this.current) return;

				// prevent setting to 'first' automatically when the slider becomes [1,1]
				this.forceContext = v === 'context';
				if (v === 'first') {
					this.current.start = 1;
					this.current.end = 1;
				} else if (v === 'all') {
					this.current.start = 1;
					this.current.end = undefined;
				} else {
					this.current.start = 1;
					this.current.end = this.contextsize;
				}
			}
		},
		contextRange: {
			get(): [number, number] { return this.current ? [this.current.start, this.current.end || this.contextsize] : [1,1] },
			set(v: [number, number]) { if (this.current) { this.current.start = v[0]; this.current.end = v[1]; } }
		},
		contextSliderPreview(): any[] {
			return Array.from({length: this.contextsize}, (_, i) => i + 1).map(i => ({value: i, label: i}));
		}
	},
	methods: {
		apply() {
			this.localModelUpToDate = true;
			this.storeModule.actions.groupBy([]);
			this.storeModule.actions.groupByAdvanced(serializeGroupBy2(this.localModel));
		},
		serializeGroupBy: serializeGroupBy2,
		humanizeGroupBy(g: GroupBySettings2): string {
			let r = '';
			if (g.type === 'annotation') {
				const position = g.position === 'H' ? 'in' : g.position === 'L' ? 'before' : g.position === 'R' ? 'after' : ''; // position | '' when using capture
				let wordcount = position ? g.end != null ? g.end + '' : 'all' : undefined; // number | 'all' | undefined when using capture

				// when start is not 1, prepend it. ex. 3 --> 1-3
				if (wordcount != null && g.start !== 1) wordcount = g.start + '-' + wordcount;

				r = `${g.annotation}${wordcount != null ? `(${wordcount})` : ''} ${position ? position + ' hit' : 'in capture ' + g.groupname}`;
			}
			else r= `document ${g.field}`;
			console.log(g, r);
			return r;
		},

		isValidGroup(group: GroupBySettings2): boolean {
			return serializeGroupBy2(group, true) != null;
		},
		removeGroup(i: number) {
			this.localModel.splice(i, 1);
			if (i === this.currentIndex)
				--this.currentIndex;
			if (this.localModel.length === 0) {
				this.clear();
			}
		},
		clear() {
			this.localModel = [];
			this.currentIndex = -1;
			this.apply();
		},
		addAnnotation() { this.localModel.push({...cloneDeep(initialGroupBySettings), type: 'annotation', annotation: this.annotations[0]?.id}); this.currentIndex = this.localModel.length -1; },
		addMetadata() { this.localModel.push({...cloneDeep(initialGroupBySettings), type: 'metadata', field: this.metadatas[0]?.id}); this.currentIndex = this.localModel.length -1; }

	},
	watch: {
		storeValue: {
			immediate: true,
			handler() {
				if (!this.localModelUpToDate) this.localModel = this.storeValue.map(parseGroupBy2);
				this.localModelUpToDate = false;
				if (this.currentIndex >= this.localModel.length) {
					this.currentIndex = this.localModel.length - 1;
				}
			},
		},
		// Watch the hash since the query params object itself can update even if it's the same (such as when paginating)
		firstHitPreviewQueryHash: {
			immediate: true,
			handler() {
				this.hits = undefined;
				if (this.firstHitPreviewQuery) {
					blacklab.getHits(INDEX_ID, this.firstHitPreviewQuery).request.then(r => this.hits = r as BLHitResults);
				}
			}
		},
		// since forceContext isn't tracked in every individual group, update this when the current group changes.
		currentIndex() {
			if (!this.current) return;
			// First disable forceContext. This will allow this.context to become something other than 'context'
			this.forceContext = false;
			// Now, if this.context still is 'context', re-enable forceContext.
			this.forceContext = this.context === 'context';
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
}

.hit-preview {
	display: flex;
	flex-wrap: nowrap;
	overflow: auto;

	.separator {
		padding: 0 0.5em;
		font-weight: bold;
	}

	.word+.word {
		padding-left: 0.5em;
	}


	.word.active {
		border-top: 1px solid black;
		border-bottom: 1px solid black;
	}

	.word.active:first-of-type {
		border-left: 1px solid black;
	}

	.word.active:last-of-type {
		border-right: 1px solid black;
	}
}

</style>
