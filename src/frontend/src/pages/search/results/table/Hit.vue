<template>
	<div>
		<HitRow :key="`${i}-hit`"
			:class="{open: open, interactable: !disableDetails && !disabled}"
			:data="h"
			:displayField="isParallel ? parallelVersion(annotatedField) : ''"
			:mainAnnotation="mainAnnotation"
			:otherAnnotations="otherAnnotations"
			:metadata="metadata"
			:dir="dir"
			:html="html"
			:disabled="disabled"
			:isParallel="isParallel"
			:hoverMatchInfos="hoverMatchInfos"
			@hover="hover($event)"
			@unhover="unhover($event)"
			@click.native="clickNative()"
		/>

		<HitRowDetails v-if="!disableDetails" :key="`${i}-details`"
			:colspan="colspan"
			:data="h"
			:open="open"
			:query="query"
			:annotatedField="annotatedField"
			:mainAnnotation="mainAnnotation"
			:detailedAnnotations="detailedAnnotations"
			:dir="dir"
			:html="html"
		/>

		<!-- Show hits in other fields (parallel corpora) -->
		<template v-for="(of) in otherFields(h.hit)">
			<HitRow :key="`${i}-${of.name}-hit`"
				:class="{open: open, interactable: !disableDetails && !disabled}"
				class="foreign-hit"
				:data="of.hit"
				:displayField="isParallel ? parallelVersion(of.name) : ''"
				:mainAnnotation="mainAnnotation"
				:otherAnnotations="otherAnnotations"
				:metadata="metadata"
				:dir="dir"
				:html="html"
				:disabled="disabled"
				:isParallel="isParallel"
				:hoverMatchInfos="hoverMatchInfos"
				@hover="hover($event)"
				@unhover="unhover($event)"
				@click.native="clickNative()"
			/>
			<HitRowDetails v-if="!disableDetails" :key="`${i}-${of.name}-details`"
				:colspan="colspan"
				:data="of.hit"
				:open="open"
				:query="query"
				:annotatedField="of.name"
				:mainAnnotation="mainAnnotation"
				:detailedAnnotations="detailedAnnotations"
				:dir="dir"
				:html="html"
			/>
		</template>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { BLDocInfo, BLHit, BLHitInOtherField, BLHitSnippet, BLMatchInfo, BLMatchInfoRelation, BLSearchParameters } from '@/types/blacklabtypes';

import * as CorpusStore from '@/store/search/corpus';
import * as QueryStore from '@/store/search/query';

import HitRow, {HitRowData} from '@/pages/search/results/table/HitRow.vue'
import HitRowDetails from '@/pages/search/results/table/HitRowDetails.vue'
import DocRow, {DocRowData} from '@/pages/search/results/table/DocRow.vue';
import { getParallelFieldName, getParallelFieldParts } from '@/utils/blacklabutils';

export {HitRowData} from '@/pages/search/results/table/HitRow.vue';

/**
 * TODO maybe move transformation of blacklab results -> hit row into this component?
 * Might be difficult as we can render this in three places which all have slightly different data.
 */
export default Vue.extend({
	components: {
		DocRow,
		HitRow,
		HitRowDetails,
	},
	props: {
		query: Object as () => BLSearchParameters|undefined,
		/** The field that was searched (for parallel corpora queries, the source field) */
		annotatedField: {
			type: String,
			default: '',
		},
		/** Annotation shown in the before/hit/after columns and expanded concordance */
		mainAnnotation: Object as () => NormalizedAnnotation,
		/** Optional. Additional annotation columns to show (besides before/hit/after) */
		otherAnnotations: Array as () => NormalizedAnnotation[]|undefined,
		/** Optional. Annotations shown in the expanded concordance.  */
		detailedAnnotations: Array as () => NormalizedAnnotation[]|undefined,
		/** Optional. Additional metadata columns to show. Normally nothing, but could show document id or something */
		metadata: Array as () => NormalizedMetadataField[]|undefined,

		dir: String as () => 'ltr'|'rtl',
		/** Render contents as html or text */
		html: Boolean,
		/** Prevent interaction with sorting, expanding/collapsing, etc. */
		disabled: Boolean,
		disableDetails: Boolean,

		/** The results */
		h: Object as () => HitRowData,
		i: Number,

		isParallel: Boolean,
	},
	data: () => ({
		open: false,
		hoverMatchInfos: [] as string[],
	}),
	computed: {
		colspan(): number {
			let c = 3; // hit, before, after
			if (this.isParallel) {
				c++; // parallel results, show field name in extra column
			}
			if (this.otherAnnotations) c += this.otherAnnotations.length;
			if (this.metadata) c += this.metadata.length;
			return c;
		}
	},
	methods: {
		clickNative() {
			if (!this.disableDetails) {
				this.open = !this.open;
			}
		},
		otherFields(h: BLHit|BLHitSnippet) {
			if (!('otherFields' in h) || h.otherFields === undefined)
				return [];

			// Copy the matchInfos from the main hit that have the correct target field to a hit in another field,
			// so that the targets can be higlighted there
			function mergeMatchInfos(fieldName: string, hit: BLHitInOtherField, mainHitMatchInfos: Record<string, BLMatchInfo>) {
				// console.log('mergeMatchInfos fieldName', JSON.stringify(fieldName));
				// console.log('  hit', JSON.stringify(hit));
				// console.log('  mainHitMatchInfos', JSON.stringify(mainHitMatchInfos));
				if (Object.keys(mainHitMatchInfos).length === 0) {
					// Nothing to merge
					// console.log('Nothing to merge');
					return hit;
				}

				/** Does the given matchInfo's targetField point to us?
				 * If it's a list, do any of the list's elements target us?
				 */
				function matchInfoHasUsAsTargets([name, matchInfo]: [string, BLMatchInfo]): boolean {
					if ('targetField' in matchInfo && matchInfo.targetField === fieldName)
						return true;
					if (matchInfo.type === 'list') {
						const infos = matchInfo.infos as BLMatchInfo[];
						if (infos.some(l => 'targetField' in l && l.targetField === fieldName))
							return true;
					}
					return false;
				};

				// Mark targetField as __THIS__ so we'll know it is us later
				function markTargetField(matchInfo: BLMatchInfo) {
					return 'targetField' in matchInfo ? ({ ...matchInfo, targetField: '__THIS__'}) : matchInfo;
				}

				// Keep only relations with us as the target field (and mark it, see above)
				const toMerge = Object.entries(mainHitMatchInfos)
					.filter(matchInfoHasUsAsTargets)
					.reduce((acc, [name, matchInfo]) => {
						if ('infos' in matchInfo) {
							acc[name] = acc[name] = {
								...matchInfo,
								infos: matchInfo.infos.map(markTargetField) as BLMatchInfoRelation[]
							};
						} else {
							acc[name] = markTargetField(matchInfo);
						}
						return acc;
					}, {} as Record<string, BLMatchInfo>);

				if (!hit.matchInfos || Object.keys(hit.matchInfos).length === 0) {
					// Hit has no matchInfos of its own; just use the infos from the main hit
					// console.log('No matchInfos in hit, just use main hit matchInfos', toMerge);
					return {
						...hit,
						matchInfos: toMerge
					};
				}

				// Construct a new hit with matchInfos merged together
				const newHit = {...hit};
				newHit.matchInfos = {...toMerge, ...hit.matchInfos};
				return newHit;

			}

			const mainHitMatchInfos = h.matchInfos || {};
			const prefix = CorpusStore.get.parallelFieldPrefix();
			const selectedTargets = QueryStore.getState().parallelVersions?.targets || [];
			const otherFieldsInOrder = selectedTargets.length > 0 ?
				selectedTargets :
				Object.keys(h.otherFields).map(f => getParallelFieldParts(f).version);
			const y = otherFieldsInOrder.map(name => {
				const fieldName = getParallelFieldName(prefix, name);
				const hit = h.otherFields![fieldName];
				const docInfo = {
						lengthInTokens: 0,
						mayView: false,
					} as BLDocInfo;
				return {
					name,
					hit: {
						type: 'hit',
						doc: {
							docInfo,
							docPid: h.docPid,
						},
						hit: mergeMatchInfos(fieldName, hit, mainHitMatchInfos),

						gloss_fields: [], //jesse
						hit_first_word_id: '', //jesse
						hit_last_word_id: '', //jesse
						hit_id: '' //jesse

					} as HitRowData
				};
			});
			return y;
		},
		parallelVersion(fieldName: string): string {
			const versionName = getParallelFieldParts(fieldName).version || fieldName;
			return CorpusStore.get.parallelVersions().find(v => v.name === versionName)?.displayName || versionName;
		},
		hover(matchInfos: string[]) {
			this.hoverMatchInfos = matchInfos;
		},
		unhover() {
			this.hoverMatchInfos = [];
		}
	},
	watch: {
		data() {
			this.open = false;
		}
	}
})

</script>