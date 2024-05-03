<template>

	<div class="group-by">
		<!-- Group selector/creator container -->
		<div class="left-sidebar">

			<label style="padding: 5px 15px; margin: 0; vertical-align: bottom; white-space: nowrap;" :title="$t('results.groupBy.preserveSettings')">
				<input type="checkbox" v-model="preserveGroupByWhenSearching"> {{ $t('results.groupBy.doNotReset') }}
			</label>

			<div :class="{'two-button-container': true, 'flex-row': localModel.length > 0, 'flex-col': localModel.length === 0}">
				<button type="button" @click="addAnnotation" class="create-group-btn btn btn-default" v-if="type === 'hits'">+ {{ $t('results.groupBy.annotation') }}</button>
				<button type="button" @click="addMetadata" class="create-group-btn btn btn-default">+ {{ $t('results.groupBy.metadata') }}</button>
			</div>

			<!-- list of current groups -->
			<div class="group" v-for="(a, i) in localModel">
				<button
					type="button"
					:key="i"
					style="text-align: left; border-radius: 0; border-right: 0; border-left: 0; flex-grow: 1;"
					:class="['btn btn-default', currentIndex === i ? 'active' : '']"
					@click="currentIndex = i;">
					<span class="text-primary" style="font-family: monospace;">[{{ a.type.substring(0, 1).toUpperCase() }}]</span> {{ humanized[i] }}
					<span v-if="!isValidGroup(a)" class="fa fas fa-warning text-danger" :title="$t('results.groupBy.invalidGrouping')"></span>
				</button>
				<button type="button" class="btn btn-danger" style="flex: 0; padding-right: 4px; padding-left: 4px;" @click="removeGroup(i)">&times;</button>
			</div>

			<!-- new group buttons -->
			<div style="flex-grow: 1; min-height: 15px;" v-if="localModel.length"></div>


			<!-- clear/apply -->
			<div class="two-button-container flex-row" v-if="localModel.length">
				<button class="btn btn-default" @click="clear">{{ $t('results.groupBy.clear') }}</button>
				<button class="btn btn-default" @click="apply">{{ $t('results.groupBy.apply') }}</button>
			</div>


		</div>

		<div class="current-group-editor panel-default">
			<template v-if="current && current.type === 'annotation'">
				<div class="hit-preview panel-heading">
					<div class="overflow-container">
						<template v-for="(section, i) of preview">
							<div v-if="i !== 0" class="separator"></div>
							<!--
								Make sure only "active" words get a <b/> tag, or the css :first-of-type selector won't match them and we lose borders
								for the main portion of the hit, we use <strong/> instead of <b/> to keep the boldness, but avoid the css issue.
							-->
							<template v-for="({word, punct, active, title}, j) of section">
								<component
									:key="word + i + '_' + j "
									:is="active ? 'b' :  i === 1 ? 'strong' : 'span'"
									:title="title"
									:class="{
										'text-primary': active,
										word: true,
										active
									}">{{ word }}</component><component :is="active ? 'b' : 'span'" :class="{punct: true, active}">{{ punct }}</component>
							</template>
						</template>
					</div>
				</div>

				{{ $t('results.groupBy.iWantToGroupOn') }} <SelectPicker
					:options="contextOptions"
					v-model="context"
					data-width="auto"
					data-menu-width="auto"
					hideEmpty
				/>
				<SelectPicker v-if="!context.startsWith('capture_')"
					v-model="current.position"
					hideEmpty
					data-width="auto"
					data-menu-width="auto"
					:options="positionOptions"
				/> {{ $t('results.groupBy.usingAnnotation') }} <SelectPicker v-if="current.type === 'annotation'"
					:placeholder="$t('results.groupBy.annotation')"
					data-width="auto"
					data-menu-width="auto"
					right
					hideEmpty
					searchable
					:options="annotations"
					v-model="current.annotation"
				/>.
				<br>
				<label><input type="checkbox" v-model="current.caseSensitive"> {{ $t('results.groupBy.caseSensitive') }}</label>

				<div style="margin: 0.75em 0 1.5em 0;"  v-if="context === 'context'">
					<div v-html="$t('results.groupBy.chooseWordPositions')"></div>
					<Slider
						:direction="(current.position === 'E' || current.position === 'L') ? 'rtl' : 'ltr'"
						inline
						:min="1"
						:max="contextsize"
						:data="contextSliderPreview"
						v-model="contextRange"
					/>
				</div>
			</template>
			<template v-else-if="current && current.type === 'metadata'">
				<section class="text-muted">
					{{ $t('results.groupBy.selectDocumentMetadata') }}<br>
					<SelectPicker
						:placeholder="$t('results.groupBy.metadata')"
						allowHtml
						hideEmpty
						data-width="auto"
						data-menu-width="auto"
						v-model="current.field"
						:options="metadata"
					/>
				</section>
				<br>
				<label><input type="checkbox" v-model="current.caseSensitive"> {{ $t('results.groupBy.caseSensitive') }}</label>
			</template>
			<div v-else class="text-secondary h4" style="height: 100%; width: 100%; margin: 0; display: flex; align-items: center;">{{ $t('results.groupBy.clickButtonsToStart') }}</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as ResultsStore from '@/store/search/results/views';
import * as UIStore from '@/store/search/ui';
import * as GlobalSearchSettingsStore from '@/store/search/results/global';

import SelectPicker, { Options } from '@/components/SelectPicker.vue';
import { GroupBySettingsUI, getAnnotationSubset, serializeGroupBySettingsUI, isValidGroupBySettingsUI, getMetadataSubset } from '@/utils';

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
import { parseGroupBySettingsUI } from '@/utils';

const initialGroupBySettings: GroupBySettingsUI = {
	type: 'annotation' as  'annotation'|'metadata',
	annotation: '',
	caseSensitive: false,
	/** when undefined, use groupname instead of positional, and ignore start+end */
	position: 'H' as 'L'|'H'|'R'|'E'|undefined,
	start: 1,
	end: undefined,
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
		storeValueUpdateIsOurs: false,
		localModel: [] as GroupBySettingsUI[],

		hits: undefined as undefined|BLHitResults
	}),
	computed: {

		preserveGroupByWhenSearching: {
			get(): boolean { return !GlobalSearchSettingsStore.get.resetGroupByOnSearch() },
			set(v: boolean) { GlobalSearchSettingsStore.actions.resetGroupByOnSearch(!v) }
		},
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		storeValue(): string[] { return this.storeModule.getState().groupBy; },
		viewGroup(): string|null { return this.storeModule.getState().viewGroup; },
		current(): GroupBySettingsUI|undefined { return this.localModel[this.currentIndex]; },
		firstHitPreviewQuery(): BLSearchParameters|undefined {
			let params = SearchModule.get.blacklabParameters();
			if (!params || !params.patt) return undefined; // can't get hits without a query

			params = {...params}; // make a copy before modifying
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

		defaultGroupingAnnotation(): string|undefined { return UIStore.getState().results.shared.groupAnnotationIds[0]; },
		defaultGroupingMetadata(): string|undefined { return UIStore.getState().results.shared.groupMetadataIds[0]; },
		annotations(): any[] {
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
		metadata(): any[] {
			const r = getMetadataSubset(
				UIStore.getState().results.shared.groupMetadataIds,
				CorpusStore.get.metadataGroups(),
				CorpusStore.get.allMetadataFieldsMap(),
				'Group',
				false,
				true
			)
			return r;
		},

		contextsize(): number { return typeof GlobalSearchSettingsStore.getState().context === 'number' ? GlobalSearchSettingsStore.getState().context as number : 5; },
		captures(): string[]|undefined {
			// TODO update types for blacklab 4
			// @ts-ignore
			const mi: BLMatchInfos = this.hits?.summary?.pattern?.matchInfos;
			// @ts-ignore
			return Object.entries(mi|| {}).filter(([k, v]) => v.type === 'span').map(([k,v]) => k)
		},

		preview(): {active: boolean, word: string, punct: string, title: string}[][] {
			if (!this.current) return [];

			/** Shorten the string, accounting for the ellipsis we add at the end */
			function shorten(w: string, maxLengthIncludingEllipsis = 8) {
				return w;
				// if (w.length > maxLengthIncludingEllipsis)
				// 	return w.substring(0, maxLengthIncludingEllipsis - 3) + '…';
				// return w;
			}
			if (this.current.type !== 'annotation' || !this.current.annotation || !isHitResults(this.hits) || !this.hits.hits.length)
				return [];

			const firstHit = this.hits.hits[0];
			const {annotation, position, start, end} = this.current;

			const left = firstHit.left?.[annotation] || [];
			const right = firstHit.right?.[annotation] || [];
			const match = firstHit.match?.[annotation] || [];

			const punct = (firstHit.left?.punct || []).concat(firstHit.match.punct).concat(firstHit.right?.punct || []);

			const startindex: number = start - 1; // correct for 1-indexed vs 0-indexed
			const endindex: number = end ?? Number.MAX_SAFE_INTEGER; // if end is not set, use entire context.

			// left/before context ('L') and hit-from-end context ('E') use inverted index in BlackLab, mimic this.
			const leftstart = left.length - endindex; // inclusive
			const leftend = left.length - startindex; // exclusive

			const fromEndOfHitStartIndex = match.length - endindex;
			const fromEndOfHitEndIndex = match.length - startindex;


			// skip first punct, it's before the first word, so pretty meaningless
			// instead, we'll shift the array one over to make the punct be the after the current word.
			let punctIndex = 1;

			return [
				left.map((w, i) => ({
					word: shorten(w) || '·',
					punct: punct[punctIndex++] || ' ',
					title: w,
					active: position === 'L' && i >= leftstart && i < leftend
				})),
				match.map((w, i) => ({
					word: shorten(w) || '·',
					punct: punct[punctIndex++] || ' ',
					title: w,
					active:
						position === 'H' ? i >= startindex && i < endindex :
						position === 'E' ? i >= fromEndOfHitStartIndex && i < fromEndOfHitEndIndex :
						false
				})),
				right.map((w, i) => ({
					word: shorten(w) || '·',
					punct: punct[punctIndex++] || ' ',
					title: w,
					active: position === 'R' && i >= startindex && i < endindex
				}))
			];
		},
		context: {
			get(): 'first'|'all'|'context'|string {
				if (!this.current) return 'context';

				if (this.current.groupname) return 'capture_' + this.current.groupname;

				if (this.forceContext) return 'context';
				if (this.current.end == null) return 'all';
				if (this.current.start === 1 && this.current.end === 1) return 'first';
				return 'context';
			},
			set(v: 'first'|'all'|'context'|string) {
				console.log('set', v)
				if (!this.current) return;

				if (v.startsWith('capture_')) {
					this.current.groupname = v.substring(8);
					this.current.position = undefined;
					this.current.start = 1;
					this.current.end = undefined;
					return;
				}

				// prevent setting to 'first' automatically when the slider becomes [1,1]
				this.forceContext = v === 'context';
				this.current.groupname = '';
				if (!this.current.position) this.current.position = 'H';
				if (v === 'first') {
					this.current.start = 1;
					this.current.end = 1;
				} else if (v === 'all') {
					this.current.start = 1;
					this.current.end = undefined;
					if (this.current.position === 'E') this.current.position = 'H'; // can't group all words in reverse (causes an exception in BlackLab)
				} else {
					this.current.start = 1;
					this.current.end = this.contextsize;
				}


			},
		},
		contextRange: {
			get(): [number, number] { return this.current ? [this.current.start, this.current.end || this.contextsize] : [1,1] },
			set(v: [number, number]) { if (this.current) { this.current.start = v[0]; this.current.end = v[1]; } }
		},
		positionOptions(): Options {
			return [
			{ label: 'before the hit', value: 'L'},
			{ label: 'in the hit', value: 'H' },
			// grouping from the end of the hit when grouping on entire hit is not possible (causes an exception in BlackLab)
			...(this.current?.end != null ? [{label: 'from the end of the hit',value: 'E'}] : []),
			{ label: 'after the hit', value: 'R' }];
		},
		contextOptions(): Options {
			return [{
				label: 'the first word',
				value: 'first'
			}, {
				label: 'all words',
				value: 'all'
			}, {
				label: 'specific words',
				value: 'context'
			}, {
				label: 'Capture groups',
				options: (this.captures || []).map(c => ({label: `capture group ${c}`, value: 'capture_' + c}))
			}];
		},
		contextSliderPreview(): any[] {
			return Array.from({length: this.contextsize}, (_, i) => i + 1).map(i => ({value: i, label: i}));
		},
		humanized(): string[] {
			return this.localModel.map(g => this.humanizeGroupBy(g));
		}
	},
	methods: {
		apply() {
			this.storeValueUpdateIsOurs = true;
			this.storeModule.actions.groupBy(serializeGroupBySettingsUI(this.localModel));
		},
		humanizeGroupBy(g: GroupBySettingsUI): string {
			let r = '';
			if (g.type === 'annotation') {
				if (g.groupname) return `label '${g.groupname}' (${g.annotation})`



				const position = (g.position === 'H' || g.position === 'E') ? 'in' : g.position === 'L' ? 'before' : g.position === 'R' ? 'after' : ''; // position | '' when using capture
				let wordcount = position ? g.end != null ? g.end + '' : 'all' : undefined; // number | 'all' | undefined when using capture

				// when start is not 1, prepend it. ex. 3 --> 1-3
				if (wordcount != null && g.start !== 1) wordcount = g.start + '-' + wordcount;

				r = `${g.annotation}${wordcount != null ? `(${wordcount})` : ''} ${position ? position + ' hit' : 'in capture ' + g.groupname}`;
			}
			else r= `document ${g.field}`;
			return r;
		},

		isValidGroup: isValidGroupBySettingsUI,
		removeGroup(i: number) {
			this.localModel.splice(i, 1);
			if (i === this.currentIndex && i > 0)
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
		addAnnotation() { this.localModel.push({...cloneDeep(initialGroupBySettings), type: 'annotation', annotation: this.defaultGroupingAnnotation!}); this.currentIndex = this.localModel.length -1; },
		addMetadata() { this.localModel.push({...cloneDeep(initialGroupBySettings), type: 'metadata', field: this.defaultGroupingMetadata!}); this.currentIndex = this.localModel.length -1; }
	},
	watch: {
		storeValue: {
			immediate: true,
			handler() {
				if (this.storeValueUpdateIsOurs) {
					this.storeValueUpdateIsOurs = false;
					return;
				}
				this.localModel = this.storeValue.map(parseGroupBySettingsUI);
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
	overflow: auto;
	border: 1px solid #ddd;
	padding: 10px 15px;
	margin: -10px -15px 15px;
	border-top: 0;
	border-right: 0;
	border-left: 0;

	.overflow-container {
		min-width: 400px;
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
	}

	.word {
		// allow some shrinkage, but not entirely.
		flex-basis: auto;
		flex-shrink: 1;
		flex-grow: 0;

		display: inline-block;
		white-space: pre;

		overflow: hidden;
		position: relative;
	}
	.punct {
		display: inline-block;
		white-space: pre;
		flex: none;
	}

	.separator {
		flex: none;
		width: 2px;
		height: auto;
		margin: 0 0.5em;
		background: #555;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.active {
		border-top: 1px solid black;
		border-bottom: 1px solid black;
	}

	.active:first-of-type {
		border-left: 1px solid black;
	}

	.active:last-of-type {
		border-right: 1px solid black;
	}
}

.group-by {
	display: flex;
	flex-direction: row;
	margin-top: 25px; // todo move into parent?
	border: 1px solid #ddd;
	border-radius: 4px;

	> *:not(:last-child) {
		border-right: 1px solid #ddd;
	}

	.left-sidebar {
		display: flex;
		flex-direction: column;
		> *:not(:last-child) {
			border-bottom: 1px solid #ddd;
		}

		.group {
			display: flex;
			flex-direction: row;
			flex-wrap: nowrap;

			 > .btn {
				border-width: 0;
				border-radius: 0;
				&:not(:last-child) { border-right-width: 1px; }
			 }
		}

		.two-button-container {
			display: flex;
			width: 100%;
			flex-direction: column;

			> .btn {
				border-width: 0;
				flex-basis: 0;
				flex-grow: 1;
				min-width: 50%;
				border-radius: 0;
			}

			&.flex-col {
				flex-grow: 1;
				flex-direction: column;
				> .btn:not(:last-child) {
					border-bottom-width: 1px!important;
				}
				> .btn {flex-grow: 1;}
			}
			&.flex-row {
				flex-direction: row;
				> .btn {
					&:not(:last-child) { border-right-width: 1px; }
				}

			}
		}
	}

	.current-group-editor {
		flex-grow: 1;
		padding: 10px 15px;
		min-width: 0;
	}
}

</style>
