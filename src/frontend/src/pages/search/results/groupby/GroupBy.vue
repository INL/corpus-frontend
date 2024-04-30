<template>

	<div class="group-by">
		<!-- Group selector/creator container -->
		<div class="left-sidebar">

			<label style="padding: 5px 15px; margin: 0; vertical-align: bottom; white-space: nowrap;" title="Keep these group settings when performing a new search">
				<input type="checkbox" v-model="preserveGroupByWhenSearching"> Do not reset on search
			</label>

			<div :class="{'two-button-container': true, 'flex-row': localModel.length > 0, 'flex-col': localModel.length === 0}">
				<button type="button" @click="addAnnotation" class="create-group-btn btn btn-default" v-if="type === 'hits'">+ Annotation</button>
				<button type="button" @click="addMetadata" class="create-group-btn btn btn-default">+ Metadata</button>
			</div>

			<!-- list of current groups -->
			<div class="group" v-for="(a, i) in localModel">
				<button
					type="button"
					:key="i"
					style="text-align: left; border-radius: 0; border-right: 0; border-left: 0; flex-grow: 1;"
					:class="['btn btn-default', currentIndex === i ? 'active' : '']"
					@click="currentIndex = i;"
				>
					<span class="text-primary" style="font-family: monospace;">[{{ a.type.substring(0, 1).toUpperCase() }}]</span> {{humanized[i]}}
					<span v-if="!isValidGroup(a)" class="fa fas fa-warning text-danger" title="This grouping is not valid."></span>
				</button>
				<button type="button" class="btn btn-danger" style="flex: 0; padding-right: 4px; padding-left: 4px;" @click="removeGroup(i)">&times;</button>
			</div>

			<!-- new group buttons -->
			<div style="flex-grow: 1; min-height: 15px;" v-if="localModel.length"></div>


			<!-- clear/apply -->
			<div class="two-button-container flex-row" v-if="localModel.length">
				<button class="btn btn-default" @click="clear">clear</button>
				<button class="btn btn-default" @click="apply">apply</button>
			</div>


		</div>

		<div class="current-group-editor panel-default">
			<template v-if="current && current.type === 'annotation'">
				<div class="content">
					I want to group on <SelectPicker
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
					/> using annotation <SelectPicker v-if="current.type === 'annotation'"
						placeholder="Annotation"
						data-width="auto"
						data-menu-width="auto"
						right
						hideEmpty
						searchable
						:options="annotations"
						v-model="current.annotation"
					/>.
					<br>
					<label><input type="checkbox" v-model="current.caseSensitive"> Case sensitive</label>

					<div style="margin: 0.75em 0 1.5em 0;"  v-if="context === 'context'">
						Choose the <strong>specific word</strong> positions to group on here, the preview at the top will show you which words you have selected.
						<Slider
							:direction="(current.position === 'E' || current.position === 'L') ? 'rtl' : 'ltr'"
							inline
							:min="1"
							:max="contextsize"
							:data="contextSliderPreview"
							v-model="contextRange"
						/>
					</div>
				</div>
				<div class="hit-preview panel-heading">
					<div class="overflow-container">
						<template v-for="(section, i) of preview">
							<div v-if="i !== 0" class="separator"></div>
							<template v-for="({selectedAnnotation, word, punct, active, title}, j) of section">
								<component
									:is="active ? 'section' : 'div'"
									:key="word + i + '_' + j"
									:class="{
										'word': true,
										'active': active,
										'text-primary': active,
										'bold': i === 1
									}"
									:style="{flexShrink: word.length}"
								>
									<div :title="word" class="main">{{ word }}</div>
									<div :title="selectedAnnotation" class="annotation">{{ selectedAnnotation }}</div>
								</component>
								<!-- punctuation between words, as we don't want it to shrink. -->
								<component :is="active ? 'section' : 'div'" :class="{punct: true, active}" :title="punct">{{ punct || ' ' }}</component>
							</template>

							<!-- <template v-for="({word, punct, active, title}, j) of section">
								<component
									:key="word + i + '_' + j "
									:is="active ? 'b' :  i === 1 ? 'strong' : 'span'"
									:title="title"
									:class="{
										'text-primary': active,
										word: true,
										active
									}">{{ word }}</component><component :is="active ? 'b' : 'span'" :class="{punct: true, active}">{{ punct }}</component>
							</template> -->
						</template>
					</div>
				</div>
			</template>
			<template v-else-if="current && current.type === 'metadata'">
				<section class="text-muted">
					Select the document metadata to group on.<br>
					<SelectPicker
						placeholder="Metadata"
						allowHtml
						hideEmpty
						data-width="auto"
						data-menu-width="auto"
						v-model="current.field"
						:options="metadata"
					/>
				</section>
				<br>
				<label><input type="checkbox" v-model="current.caseSensitive"> Case sensitive</label>
			</template>
			<div v-else class="text-secondary h4" style="height: 100%; width: 100%; margin: 0; display: flex; align-items: center;">In this window you can apply grouping to the results. Click the buttons on the left to create a grouping criteria to get started.</div>
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

import {isHitResults, BLSearchResult, BLSearchParameters, BLHitResults, BLHitSnippetPart} from '@/types/blacklabtypes';

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
		annotations(): Options {
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
		metadata(): Options {
			const r = getMetadataSubset(
				UIStore.getState().results.shared.groupMetadataIds,
				CorpusStore.get.metadataGroups(),
				CorpusStore.get.allMetadataFieldsMap(),
				'Group',
				debug.debug, // is debug enabled - i.e. show debug labels in dropdown
				true
			)
			return r;
		},

		contextsize(): number {
			return typeof GlobalSearchSettingsStore.getState().context === 'number' ? GlobalSearchSettingsStore.getState().context as number : 5;
		},
		captures(): string[]|undefined {
			// TODO update types for blacklab 4
			// @ts-ignore
			const mi: BLMatchInfos = this.hits?.summary?.pattern?.matchInfos;
			// @ts-ignore
			return Object.entries(mi|| {}).filter(([k, v]) => v.type === 'span').map(([k,v]) => k)
		},

		preview(): {
			active: boolean,
			word: string,
			selectedAnnotation: string,
			punct: string,
		}[][] {
			if (!this.current) return [];
			if (this.current.type !== 'annotation' || !this.current.annotation || !isHitResults(this.hits) || !this.hits.hits.length)
				return [];

			const firstHit = this.hits.hits[0];
			const {annotation, position, start, end} = this.current;

			// We assume that whatever annotation is shown in the concordances is the main "word" annotation.
			const wordAnnotation = UIStore.getState().results.shared.concordanceAnnotationId;

			// Collect the values of the words and the values of the selected annotation.
			const leftSelected = firstHit.left?.[annotation] || [];
			const rightSelected = firstHit.right?.[annotation] || [];
			const matchSelected = firstHit.match?.[annotation] || [];
			const leftWords = firstHit.left?.[wordAnnotation] || [];
			const rightWords = firstHit.right?.[wordAnnotation] || [];
			const matchWords = firstHit.match?.[wordAnnotation] || [];

			// We'll also need the punctuation between words.
			const punct = (firstHit.left?.punct || []).concat(firstHit.match.punct).concat(firstHit.right?.punct || []);

			const startindex: number = start - 1; // correct this for 1-indexed vs 0-indexed. BlackLab returns 1-indexed hits (i.e. first word in the document is 1)
			const endindex: number = end ?? Number.MAX_SAFE_INTEGER; // if end is not set, use entire context.

			// left/before context ('L') and hit-from-end context ('E') use inverted index in BlackLab, mimic this.
			const leftstart = leftSelected.length - endindex; // inclusive
			const leftend = leftSelected.length - startindex; // exclusive

			const fromEndOfHitStartIndex = matchSelected.length - endindex;
			const fromEndOfHitEndIndex = matchSelected.length - startindex;


			// skip first punct, it's before the first word, so pretty meaningless
			// instead, we'll shift the array one over to make the punct be the after the current word.
			let punctIndex = 1;

			return [
				leftSelected.map((w, i) => ({
					word: leftWords[i] || '·',
					selectedAnnotation: w || '·',
					punct: punct[punctIndex++] || ' ',
					active: position === 'L' && i >= leftstart && i < leftend
				})),
				matchSelected.map((w, i) => ({
					word: matchWords[i] || '·',
					selectedAnnotation: w || '·',
					punct: punct[punctIndex++] || ' ',
					active:
						position === 'H' ? i >= startindex && i < endindex :
						position === 'E' ? i >= fromEndOfHitStartIndex && i < fromEndOfHitEndIndex :
						false
				})),
				rightSelected.map((w, i) => ({
					word: rightWords[i] || '·',
					selectedAnnotation: w || '·',
					punct: punct[punctIndex++] || ' ',
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
			this.metadata

			let r = '';
			if (g.type === 'annotation') {
				if (g.groupname) return `label '${g.groupname}' (${g.annotation})`

				const position = (g.position === 'H' || g.position === 'E') ? 'in' : g.position === 'L' ? 'before' : g.position === 'R' ? 'after' : ''; // position | '' when using capture
				let wordcount = position ? g.end != null ? g.end + '' : 'all' : undefined; // number | 'all' | undefined when using capture

				// when start is not 1, prepend it. ex. 3 --> 1-3
				if (wordcount != null && g.start !== 1) wordcount = g.start + '-' + wordcount;

				r = `${g.annotation}${wordcount != null ? ` (${wordcount})` : ''} ${position ? position + ' hit' : 'in capture ' + g.groupname}`;
			}
			else r = `document ${CorpusStore.get.allMetadataFieldsMap()[g.field].displayName}`;
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

.current-group-editor {
	flex-grow: 1; // take up remainder of horizontal space
	min-width: 0;
	display: flex;
	flex-direction: column;

	> .content {
		padding: 10px 15px;
		flex-grow: 1; // push down preview
	}
	> .hit-preview {
		align-self: flex-end;
		width: 100%;
		margin: 0;
		border-bottom: 0;
		border-top: 1px solid #ddd;
		border-top-left-radius: 0;
		border-top-right-radius: 0;
		border-bottom-right-radius: 4px;;
	}
}




.hit-preview {
	overflow: auto;
	border: 1px solid #ddd;
	padding: 10px 15px;
	margin: 0 -15px 0;
	border-top: 0;
	border-right: 0;
	border-left: 0;

	.overflow-container {
		min-width: 600px;
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
	}


	/**
		Container for a word in the preview.
		It has the word at the top, and hovering just below it, the annotation's value
		It can shrink if the parent container is out of space.
	*/
	.word {
		font-size: 125%;
		display: inline-flex;
		flex-direction: column;
		flex-shrink: 1; // overridden on the element itself, based on word length
		flex-basis: auto;
		flex-grow: 0;
		overflow: hidden; // hide the annotation if it's too long.
		position: relative; // we don't need this I think?
		padding-bottom: 0.5em; // space for the annotation value that hovers below the word.
	}

	.punct {
		flex: none;
		white-space: pre;
	}

	.word > .main {
		display: flex;
		flex-shrink: 1;
		flex-grow: 0;
		flex-basis: auto;
		white-space: pre;
	}

	.word > .annotation {
		font-size: 75%;
		opacity: 0.75;
		font-style: italic;
		position: absolute;
		left: 0.5em;
		bottom: 0;
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
		border-top-left-radius: 6px;
		border-bottom-left-radius: 6px;
	}

	.active:last-of-type {
		border-right: 1px solid black;
		border-top-right-radius: 6px;
		border-bottom-right-radius: 6px;
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
}

</style>
