<template>

	<button v-if="!active && !localModel.length" class="btn btn-default btn-secondary btn-sm" type="button" @click="active=true">
		{{$t('results.groupBy.groupResults')}}
	</button>
	<div v-else class="panel panel-default">
		<div class="panel-heading" style="margin: 0">{{$t('results.groupBy.groupResults')}} <button class="pull-right close" type="button" @click="clear">&times;</button></div>

		<div class="group-by">
			<!-- Group selector/creator container -->
			<div class="left-sidebar">
				<div :class="{'two-button-container': true, 'flex-row': localModel.length > 0, 'flex-col': localModel.length === 0}">
					<button type="button" @click="addAnnotation" class="create-group-btn btn btn-default" v-if="type === 'hits'">+ {{ $t('results.groupBy.annotation') }}</button>
					<button type="button" @click="addMetadata" class="create-group-btn btn btn-default">+ {{ $t('results.groupBy.metadata') }}</button>
				</div>

				<!-- list of current groups -->
				<div v-if="localModel.length" class="groups">
					<div class="group" v-for="(a, i) in localModel">
						<button
							type="button"
							:key="i"
							:class="['btn btn-default group-select-button', currentIndex === i ? 'active' : '']"
							@click="currentIndex = i;"
						>
							<span class="text-primary" style="font-family: monospace;">[{{ a.type === 'metadata' ? 'M' : 'A' }}]</span>
							<span :class="isEmptyGroup(a) ? 'text-muted' : ''">{{humanized[i]}}</span>
							<span v-if="isInvalidGroup(a)" class="fa fas fa-warning text-danger" :title="$t('results.groupBy.invalidGrouping')"></span>
						</button>
						<button type="button" class="btn btn-danger group-delete-button" @click="removeGroup(i)">&times;</button>
					</div>
				</div>

				<div v-if="localModel.length" style="flex-grow: 1; margin-top: -1px; /*collapse borders between groups and bottom buttons*/"></div>

				<!-- clear/apply -->
				<div class="two-button-container flex-row" v-if="localModel.length">
					<button class="btn btn-primary" @click="apply">{{ $t('results.groupBy.apply') }}</button>
					<button class="btn btn-default" @click="clear">{{ $t('results.groupBy.clear') }}</button>
				</div>
			</div>

			<div class="current-group-editor panel-default">
				<div class="content" v-if="current">
					<template v-if="current.type === 'context'">
						<div class="content">
							<i18n path="results.groupBy.iWantToGroupOnAnnotation" tag="div">
								<!-- allow unknown values here. If grouping on a capture group/relation, they're not always available immediately (we need the first hit to decode them). -->
								<template #some_words><SelectPicker
									:options="contextOptions"
									v-model="contextValue"
									allowUnknownValues
									data-width="auto"
									data-menu-width="auto"
									hideEmpty
									allowHtml
								/></template>
								<!-- Specific layout, we want to hide the selectpicker, but there might be surrounding text that also needs to be hidden... -->
								<template #in_this_location_with_text>
									<!-- if not grouping on a label but on a specific position, then show the position picker. -->
									<i18n v-if="currentAsPositional" path="results.groupBy.in_this_location_with_text">
										<template #in_this_location> <!-- doesn't seem to work if we don't wrap the selectpicker in a template. -->
											<SelectPicker
												v-model="positionValue"
												hideEmpty
												data-width="auto"
												data-menu-width="auto"
												:options="positionOptions"
											/>
										</template>
									</i18n>
								</template>
								<template #this_annotation>
								<SelectPicker
									:placeholder="'...' + '\xa0'.repeat(20) /*nbsp*/"
									data-width="auto"
									data-menu-width="auto"
									right
									searchable
									hideEmpty
									:options="annotations"
									v-model="current.annotation"
								/></template>
							</i18n>


							<form class="case-and-context">
								<div class="labels">
									<label for="group-case-sensitive">{{ $t('results.groupBy.caseSensitive') }}: </label>
									<label v-if="current.context.type === 'label' && relations?.includes(current.context.label)" for="group-relation">{{ $t('results.groupBy.relationPartLabel') }}:</label>
								</div>
								<div class="inputs">
									<input id="group-case-sensitive" type="checkbox" v-model="current.caseSensitive">
									<div v-if="current.context.type === 'label' && relations?.includes(current.context.label)" class="btn-group">
										<button type="button"
											class="btn btn-default btn-sm"
											:class="{active: current.context.relation === 'target'}"
											@click="current.context.relation = 'target'"
											>{{$t('results.groupBy.relationTarget')}}</button>
										<button type="button"
											class="btn btn-default btn-sm"
											:class="{active: current.context.relation === 'source'}"
											@click="current.context.relation = 'source'"
										>{{$t('results.groupBy.relationSource')}}</button>
										<!-- Never want to group on things in between source and target of a relation apparently. So don't show this button. -->
										<!-- <button type="button"
											class="btn btn-default btn-sm"
											:class="{active: current.context.relation === 'full' || !current.context.relation}"
											@click="current.context.relation = 'full'"
										>{{$t('results.groupBy.relationBoth')}}</button> -->
									</div>
								</div>
							</form>


							<div style="padding: 10px 0 25px;"  v-if="sliderVisible">
								<div v-html="$t('results.groupBy.chooseWordPositions')"></div>
								<Slider
									:direction="sliderInverted ? 'rtl' : 'ltr'"
									inline
									:min="1"
									:max="contextsize"
									:data="sliderLabels"
									v-model="sliderValue"
								/>
							</div>

							<em class="text-secondary" v-if="relations || captures"><span class="fa fa-exclamation-triangle text-primary"></span> {{$t('')}}Tip: click on highlighted words for syntactic grouping. ⤵</em>
						</div>
					</template>
					<div v-else-if="current.type === 'metadata'" class="content">
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

						<br>
						<label><input type="checkbox" v-model="current.caseSensitive"> {{ $t('results.groupBy.caseSensitive') }}</label>
					</div>
					<div v-else-if="current.type === 'custom'">
						{{current.value}}
					</div>
				</div>
				<em v-else class="text-italic h5 text-muted content" style="display: flex; align-items: center; margin: 0; justify-self: center;">{{ $t('results.groupBy.clickButtonsToStart') }}</em>
				<div v-if="current && current.type === 'context'" class="hit-preview panel-heading">
					<template v-for="(section, i) of preview">
						<div v-if="i !== 0" class="separator"></div>
						<template v-for="({selectedAnnotation, word, punct, active, style}, j) of section">
							<component
								:is="active ? 'section' : 'div'"
								:key="word + i + '_' + j"
								:class="{
									'word': true,
									'active': active,
									'text-primary': active,
									'bold': i === 1
								}"
								:style="style"
								@click="handlePreviewClick($event, i, j)"
							>
								<div :title="word" class="main">{{ word }}</div>
								<div :title="selectedAnnotation" class="annotation">{{ selectedAnnotation }}</div>
							</component>
							<!-- punctuation between words. -->
							<component :is="active && section[j+1]?.active ? 'section' : 'div'" :class="{punct: true, active: active && section[j+1]?.active}" :title="punct">{{ punct || ' ' }}</component>
						</template>
					</template>
				</div>
				<!-- <Debug v-if="current"><pre>Debug: {{ current }} <br> {{ {contextValue, preview} }}</pre></Debug> -->
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as CorpusStore from '@/store/search/corpus';
import * as UIStore from '@/store/search/ui';
import * as ResultsStore from '@/store/search/results/views';
import * as GlobalSearchSettingsStore from '@/store/search/results/global';
import * as SearchModule from '@/store/search/index';

import { getAnnotationSubset, getMetadataSubset } from '@/utils';
import { blacklab } from '@/api';

import {isHitResults, BLSearchResult, BLSearchParameters, BLHitResults} from '@/types/blacklabtypes';

import {GroupBy, serializeGroupBy, parseGroupBy, isValidGroupBy, ContextPositional, GroupByContext, ContextLabel} from '@/utils/grouping';

import debug from '@/utils/debug';

// @ts-ignore
import Slider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css'
import jsonStableStringify from 'json-stable-stringify';

import SelectPicker, { Options } from '@/components/SelectPicker.vue';
import { getHighlightColors, snippetParts } from '@/utils/hit-highlighting';
import { CaptureAndRelation, HitToken, TokenHighlight } from '@/types/apptypes';

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
		/** index into localModel that is displayed in the UI */
		currentIndex: 0,
		/** micro optimization: whether to skip next parse since the new value came from us anyway. */
		storeValueUpdateIsOurs: false,
		localModel: [] as GroupBy[],

		hits: undefined as undefined|BLHitResults,

		active: false
	}),
	computed: {
		storeModule(): ResultsStore.ViewModule { return ResultsStore.getOrCreateModule(this.type); },
		storeValue(): string[] { return this.storeModule.getState().groupBy; },
		current(): GroupBy|undefined { return this.localModel[this.currentIndex]; },
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
				UIStore.getState().dropdowns.groupBy.metadataGroupLabelsVisible
			)
			return r;
		},

		contextsize(): number {
			let params = SearchModule.get.blacklabParameters();
			if (!params || !params.patt) return 5; // default
			return typeof params.context === 'number' ? params.context as number :  // use actual value from query if set
			       typeof GlobalSearchSettingsStore.getState().context === 'number' ? GlobalSearchSettingsStore.getState().context as number :  // use global default if set
			       5; // use default
		},
		captures(): string[]|undefined {
			const mi = this.hits?.summary?.pattern?.matchInfos;
			// @ts-ignore
			return Object.entries(mi|| {}).filter(([k, v]) => v.type === 'span').map(([k,v]) => k)
		},
		relations(): string[]|undefined {
			const mi = this.hits?.summary?.pattern?.matchInfos;
			// @ts-ignore
			return Object.entries(mi|| {}).filter(([k, v]) => v.type === 'relation').map(([k,v]) => k)
		},
		colors(): Record<string, TokenHighlight> {
			return this.hits ? getHighlightColors(this.hits.summary) : {};
		},

		// Some utils to cast the current group to a specific type.
		// so we can use it in computeds for the template.
		currentAsLabel(): undefined|GroupByContext<ContextLabel> { if (this.current?.type === 'context' && this.current.context.type === 'label') return this.current as GroupByContext<ContextLabel>; },
		currentAsPositional(): undefined|GroupByContext<ContextPositional> { if (this.current?.type === 'context' && this.current.context.type === 'positional') return this.current as GroupByContext<ContextPositional>; },
		currentAsSlider(): undefined|GroupByContext<ContextPositional> { if (this.currentAsPositional?.context.info.type === 'specific') return this.currentAsPositional; },

		sliderVisible(): boolean { return !!this.currentAsSlider; },
		sliderInverted(): boolean { const p = this.currentAsSlider?.context.position; return p === 'E' || p === 'B'; },
		sliderLabels(): any[] { return Array.from({length: this.contextsize}, (_, i) => i + 1).map(i => ({value: i, label: i})); },
		sliderValue: {
			get(): [number, number] { return this.currentAsSlider ? [this.currentAsSlider.context.info.start, this.currentAsSlider.context.info.end] : [1, 1]; },
			set(v: [number, number]) {
				if (this.currentAsSlider) {
					this.currentAsSlider.context.info.start = v[0];
					this.currentAsSlider.context.info.end = v[1];
				}
			}
		},

		preview(): {
			active: boolean;
			word: string;
			selectedAnnotation: string;
			punct: string;
			style: object;
			captureAndRelation: CaptureAndRelation[]|undefined;
		}[][] {
			if (this.current?.type !== 'context' || !isHitResults(this.hits) || !this.hits.hits.length) return [];

			const wordAnnotation = UIStore.getState().results.shared.concordanceAnnotationId;
			const firstHit = this.hits.hits[0];
			const {annotation, context} = this.current;

			const snippet = snippetParts(firstHit, wordAnnotation, CorpusStore.get.textDirection(), this.colors)
			const position = context.type === 'positional' ? context.position : undefined;

			// Now extact the indices of the tokens that are active (i.e. being grouped on).
			// start and end here are INCLUSIVE and 0-indexed. While start + end in the GroupBy object are 1-indexed.
			// If we're not grouping on a specific word, we'll just show the entire snippet without anything highlighted.
			let start =  Number.MAX_SAFE_INTEGER;
			let end = -Number.MAX_SAFE_INTEGER;
			if (context.type === 'positional') {
				const pos = context.info;
				if (pos.type === 'all') { start = 0; end = Number.MAX_SAFE_INTEGER; }
				else if (pos.type === 'first') { start = 0; end = 0; }
				else { start = pos.start! - 1; end = pos.end! - 1; }

				// left/before context ('B') and hit-from-end context ('E') use inverted index in BlackLab, mimic this.
				if (position === 'E' || position === 'B') {
					const sectionLength = position === 'E' ? snippet.match.length : snippet.before.length;
					// subtract 1 because array.length is 1 more than the last index.
					const tmp = start;
					start = sectionLength - end - 1;
					end = sectionLength - tmp - 1;
				}
			}

			const isActiveIndex = (i: number): boolean => i >= start && i <= end;

			const isActiveRelationOrCapture = (t: HitToken): boolean => {
				/** might be null if not grouping on a capture at the moment */
				const currentlyGroupedOnCaptureOrRelation =  t.captureAndRelation?.find(c => c.key === this.currentAsLabel?.context.label);
				if (!currentlyGroupedOnCaptureOrRelation) return false;

				if (this.currentAsLabel?.context.relation === 'source') { return currentlyGroupedOnCaptureOrRelation.isSource; }
				else if (this.currentAsLabel?.context.relation === 'target') { return currentlyGroupedOnCaptureOrRelation.isTarget; }
				else return true;
			}

			const getPreviewStyle = (t: HitToken): object => {
				return t.captureAndRelation?.length ? {
					background: `linear-gradient(90deg, ${t.captureAndRelation.map((c, i) => `${c.highlight.color} ${i / t.captureAndRelation!.length * 100}%, ${c.highlight.color} ${(i + 1) / t.captureAndRelation!.length * 100}%`)})`,
					color: t.captureAndRelation[0].highlight.textcolor,
					textShadow: `0 0 1.25px ${t.captureAndRelation[0].highlight.textcolorcontrast},`.repeat(10).replace(/,$/, ''),
					cursor: 'pointer',
				} : {}
			}

			return [
				snippet.before.map((t, i) => ({
					word: t.text || '·',
					selectedAnnotation: t.annotations[annotation!] || '·',
					punct: t.punct,
					active: (position === 'B' && isActiveIndex(i)) || isActiveRelationOrCapture(t),
					style: getPreviewStyle(t),
					captureAndRelation: t.captureAndRelation,
				})),
				snippet.match.map((t, i) => ({
					word: t.text || '·',
					selectedAnnotation: t.annotations[annotation!] || '·',
					punct: t.punct,
					active: ((position === 'H' || position === 'E') && isActiveIndex(i)) || isActiveRelationOrCapture(t),
					style: getPreviewStyle(t),
					captureAndRelation: t.captureAndRelation,
				})),
				snippet.after.map((t, i) => ({
					word: t.text || '·',
					selectedAnnotation: t.annotations[annotation!] || '·',
					punct: t.punct,
					active: (position === 'A' && isActiveIndex(i)) || isActiveRelationOrCapture(t),
					style: getPreviewStyle(t),
					captureAndRelation: t.captureAndRelation,
				}))
			];
		},

		contextOptions(): Options {
			return [{
				label: this.$t('results.groupBy.some_words.theFirstWord').toString(),
				value: 'first'
			}, {
				label: this.$t('results.groupBy.some_words.allWords').toString(),
				value: 'all'
			}, {
				label: this.$t('results.groupBy.some_words.specificWords').toString(),
				value: 'specific'
			}, {
				label: this.$t('results.groupBy.some_words.captureGroupsLabel').toString(),
				options: (() => {
					const r = [];
					if (this.relations?.length) {
						r.push(...this.relations.map(c => ({
							label: `<span class="color-ball" style="background-color: ${this.colors[c].color};">&nbsp;</span> relation ${c}`,
							value: c
						})));
					}
					if (this.captures?.length) {
						r.push(...this.captures.map(c => ({
							label: `<span class="color-ball" style="background-color: ${this.colors[c].color};">&nbsp;</span> capture ${c}`,
							value: c
						})));
					}
					return r;
				})()
			}];
		},
		contextValue: {
			/** The string value is when grouping on a capture group or relation. */
			get(): 'first'|'all'|'context'|string {
				if (this.currentAsLabel) return this.currentAsLabel.context.label;
				else if (this.currentAsPositional) return this.currentAsPositional.context.info.type;
				return '';
			},
			/** The string value is when grouping on a capture group or relation. */
			set(v: 'first'|'all'|'specific'|string) {
				if (this.current?.type !== 'context') return;

				// should never happen we receive one of these options when type is not 'positional'
				// but make typescript happy.
				if (v === 'first' || v === 'all' || v === 'specific') {
					if (this.currentAsPositional) {
						this.currentAsPositional.context.info.type = v;
					} else {
						// update context object as we're currently grouping on a label.
						this.current.context = {
							type: 'positional',
							info: {type: v, start: 1, end: this.contextsize},
							position: 'H'
						}
					}
					// if we're grouping on the entire hit, we can't group from the end. (blacklab limitation)
					if (v === 'all' && this.currentAsPositional?.context.position === 'E') {
						this.currentAsPositional.context.position = 'H';
					}
				} else {
					this.current.context = {
						type: 'label',
						label: v,
						relation: this.relations?.includes(v) ? 'target' : undefined
					}
				}
			},
		},

		positionOptions(): Options {
			if (!(this.current?.type === 'context' && this.current.context.type === 'positional')) return [];

			return [
			{ label: this.$t('results.groupBy.in_this_location.beforeTheHit').toString(), value: 'B'},
			{ label: this.$t('results.groupBy.in_this_location.inTheHit').toString(), value: 'H' },
			// grouping from the end of the hit when grouping on entire hit is not possible (causes an exception in BlackLab)
			...(this.current?.context.info.type !== 'all' ? [{label: this.$t('results.groupBy.in_this_location.fromTheEnd').toString(), value: 'E'}] : []),
			{ label: this.$t('results.groupBy.in_this_location.afterTheHit').toString(), value: 'A' }];
		},
		positionValue: {
			get(): 'B'|'H'|'E'|'A' { return this.current?.type === 'context' && this.current.context.type === 'positional' ? this.current.context.position : 'H'; },
			set(v: 'B'|'H'|'E'|'A') {
				if (this.current?.type === 'context' && this.current.context.type === 'positional')
					this.current.context.position = v ;
			}
		},


		humanized(): string[] {
			return this.localModel.map(g => this.humanizeGroupBy(g));
		}
	},
	methods: {
		apply() {
			this.storeValueUpdateIsOurs = true;
			this.storeModule.actions.groupBy(serializeGroupBy(this.localModel.filter(isValidGroupBy)));
		},
		humanizeGroupBy(g: GroupBy): string {
			if (g.type === 'context') {
				if (!g.annotation) return this.$t('results.groupBy.specify').toString();

				// when using capture label or relation, done.
				if (g.context.type === 'label') {
					return this.$t('results.groupBy.label', {
						label: g.context.label,
						annotation: g.annotation
					}).toString();
				}

				const position = (g.context.position === 'H' || g.context.position === 'E') ? 'in' : g.context.position === 'B' ? 'before' : 'after';

				let wordCount: string;

				if (g.context.info.type === 'all') wordCount = 'all';
				else if (g.context.info.type === 'first') wordCount = 'first';
				else if (g.context.info.start === g.context.info.end) wordCount = g.context.info.start + '';
				else wordCount =`${g.context.info.start}-${g.context.info.end}`;

				return `${g.annotation}${wordCount ? ` (${wordCount})` : ''} ${position + ' hit'}`;
			} else if (g.type === 'metadata') {
				if (!g.field) return this.$t('results.groupBy.specify').toString();
				return `document ${CorpusStore.get.allMetadataFieldsMap()[g.field].displayName}`;
			} else {
				return g.value;
			}
		},

		isEmptyGroup(group: GroupBy) { return (group.type === 'context' && !group.annotation) || (group.type === 'metadata' && !group.field); },
		isInvalidGroup(group: GroupBy) { return !this.isEmptyGroup(group) && !isValidGroupBy(group); },
		removeGroup(i: number) {
			if (this.currentIndex >= i) this.currentIndex--;
			this.localModel.splice(i, 1);
		},
		clear() {
			this.localModel = [];
			this.currentIndex = -1;
			this.active = false;
			this.apply();
		},
		addAnnotation() {
			this.localModel.push({
				type: 'context',
				annotation: '',
				context: {type: 'positional', info: {type: 'all', start: 1, end: this.contextsize}, position: 'H'},
				caseSensitive: false
			});
			this.currentIndex = this.localModel.length -1;
		},
		addMetadata() {
			this.localModel.push({
				type: 'metadata',
				field: '',
				caseSensitive: false
			});
			this.currentIndex = this.localModel.length -1;
		},
		/**
		 * When a highlighted word in the preview is clicked, retrieve what it represents (a capture group, or relation source/target)
		 * And update the current grouping criterium to be that.
		 *
		 * When a word has multiple things it represents, use the position of the click to determine which one was clicked.
		 * When a relation is clicked and it's already the current relation, toggle between source/target and full context.
		 */
		handlePreviewClick(event: MouseEvent, section: number, index: number) {
			const preview = this.preview[section][index];
			if (!preview.captureAndRelation?.length || this.current?.type !== 'context') return;

			const elementRect = (event.target as HTMLElement).getBoundingClientRect();
			const elementLeftBorder = elementRect.left + window.scrollX;
			const clickPositionInElement = event.pageX - elementLeftBorder;
			const elementWidth = elementRect.width;

			// sometimes a click slightly outside the element can cause a negative or overflow value, so clamp it.
			const relationIndex = Math.max(0, Math.min(Math.floor((clickPositionInElement / elementWidth) * preview.captureAndRelation.length), preview.captureAndRelation.length - 1));
			const relation = preview.captureAndRelation[relationIndex];

			this.current.context = {
				type: 'label',
				label: relation.key,
				relation: relation.isSource ? 'source' : relation.isTarget ? 'target' : undefined
			}
		},
	},
	watch: {
		storeValue: {
			immediate: true,
			handler() {
				if (this.storeValueUpdateIsOurs) {
					this.storeValueUpdateIsOurs = false;
					return;
				}
				this.localModel = parseGroupBy(this.storeValue);
				this.active = this.active || this.localModel.length > 0;
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

.group-select-button {
	text-align: left; border-radius: 0; border-right: 0; border-left: 0; flex-grow: 1;
}
.group-delete-button {
	flex: 0; padding-right: 4px; padding-left: 4px;
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
		border-bottom-right-radius: 4px;
	}
}


.case-and-context {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	padding: 10px 0;


	> .labels {
		padding-right: 10px;
		flex-shrink: 1;
		flex-basis: auto;
		> * {
			margin-bottom: 0.5em;
			display: block;
			line-height: 30px;
		}
	}
	>.inputs {
		flex-grow: 1;
		flex-basis: auto;
		> * {
			margin-bottom: 0.5em;
			height: 30px;
			display: block;
		}

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


	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	justify-content: safe center;

	/**
		Container for a word in the preview.
		It has the word at the top, and hovering just below it, the annotation's value
	*/
	.word {
		font-size: 125%;
		flex: none;
		overflow: hidden; // hide the annotation if it's too long.
		position: relative;
		padding-bottom: 0.5em; // space for the annotation value that hovers below the word.
	}

	/** In between words. Is separate from the word container because in the past words could be shrunk, but punctuation was exempt from that. */
	.punct {
		flex: none;
		white-space: pre;
	}

	.word > .main {
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
			&:not(:last-child) {
				border-bottom: 1px solid #ddd;
			}

			 > .btn {
				border-width: 0;
				border-radius: 0;
				// &:not(:last-child) { border-right-width: 1px; }
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

.color-ball {
	border-radius: 100%;
	width: 16px;
	height: 16px;

	display: inline-block;
	vertical-align: center;
}

</style>
