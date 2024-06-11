<template>
	<table class="hits-table">
		<thead>
			<tr class="rounded">
				<th class="text-right">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							{{leftLabel}} {{$t('results.table.hit')}}
							<span class="caret"></span>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`${beforeField}:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>{{leftLabel}} {{$t('results.table.hit')}}</template>
				</th>

				<th class="text-center">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							{{$t('results.table.hit')}}
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`hit:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>{{$t('results.table.hit')}}</template>
				</th>

				<th class="text-left">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							{{rightLabel}} {{$t('results.table.hit')}}
							<span class="caret"></span>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`${afterField}:${annotation.id}`)" :class="['sort', {'disabled':disabled}]" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>{{rightLabel}} {{$t('results.table.hit')}}</template>
				</th>
				<!-- might crash? no null check -->
				<th v-for="annotation in otherAnnotations" :key="annotation.id">
					<a v-if="annotation.hasForwardIndex"
						role="button"
						:class="['sort', {'disabled':disabled}]"
						:title="`Sort by ${annotation.displayName}`"
						@click="changeSort(`hit:${annotation.id}`)"
					>
						{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug>
					</a>
					<template v-else>{{annotation.displayName}}</template>
				</th>
				<th v-for="meta in metadata" :key="meta.id">
					<a
						role="button"
						:class="['sort', {'disabled':disabled}]"
						:title="`Sort by ${meta.displayName}`"
						@click="changeSort(`field:${meta.id}`)"
					>
						{{meta.displayName}} <Debug>(id: {{meta.id}})</Debug>
					</a>
				</th>
				<!-- glosses todo -->
				<!-- <th v-for="(fieldName, i) in shownGlossCols" :key="i"><a class='sort gloss_field_heading' :title="`User gloss field: ${fieldName}`">{{ fieldName }}</a></th> -->
			</tr>
		</thead>
		<template v-for="(h, i) in data">
			<Hit v-if="h.type === 'hit'"
				:query="query"
				:annotatedField="annotatedField"
				:mainAnnotation="mainAnnotation"
				:otherAnnotations="otherAnnotations"
				:detailedAnnotations="detailedAnnotations"
				:metadata="metadata"
				:dir="dir"
				:html="html"
				:disabled="disabled"
				:disableDetails="disableDetails"
				:h="h"
				:i="i"
				:isParallel="isParallel"
			/>
			<DocRow v-else :key="`${i}-doc`"
				:data="h"
				:metadata="metadata"
				:colspan="colspan"
			/>
		</template>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { BLDocInfo, BLHit, BLHitInOtherField, BLHitSnippet, BLMatchInfo, BLMatchInfoRelation, BLSearchParameters } from '@/types/blacklabtypes';

import * as CorpusStore from '@/store/search/corpus';
import * as QueryStore from '@/store/search/query';

import Hit from '@/pages/search/results/table/Hit.vue';
import HitRow, {HitRowData} from '@/pages/search/results/table/HitRow.vue'
import HitRowDetails from '@/pages/search/results/table/HitRowDetails.vue'
import DocRow, {DocRowData} from '@/pages/search/results/table/DocRow.vue';
import { getParallelFieldName, getParallelFieldParts, isParallelField } from '@/utils/blacklabutils';
import { snippetParts } from '@/utils/hit-highlighting';

export {HitRowData} from '@/pages/search/results/table/HitRow.vue';

/**
 * TODO maybe move transformation of blacklab results -> hit row into this component?
 * Might be difficult as we can render this in three places which all have slightly different data.
 */
export default Vue.extend({
	components: {
		DocRow,
		Hit,
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
		/** Optional */
		sortableAnnotations: Array as () => NormalizedAnnotation[]|undefined,

		dir: String as () => 'ltr'|'rtl',
		/** Render contents as html or text */
		html: Boolean,
		/** Prevent interaction with sorting, expanding/collapsing, etc. */
		disabled: Boolean,
		disableDetails: Boolean,

		/** The results */
		data: Array as () => Array<HitRowData|DocRowData>,
	},
	computed: {
		// ltr, rtl stuff
		leftLabel(): string { return this.dir === 'rtl' ? this.$t('results.table.After') as string : this.$t('results.table.Before') as string; },
		rightLabel(): string { return this.dir === 'rtl' ? this.$t('results.table.Before') as string : this.$t('results.table.After') as string; },
		beforeField(): string { return this.dir === 'rtl' ? this.$t('results.table.after') as string : this.$t('results.table.before') as string; },
		afterField(): string { return this.dir === 'rtl' ? this.$t('results.table.before') as string : this.$t('results.table.after') as string; },
		isParallel(): boolean {
			return this.data.find(d => d.type === 'hit' && 'otherFields' in d.hit) !== undefined;
		},
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
		changeSort(sort: string) {
			this.$emit('changeSort', sort)
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
				const s = mergeMatchInfos(fieldName, hit, mainHitMatchInfos);
				return {
					name,
					hit: {
						type: 'hit',
						doc: {
							docInfo,
							docPid: h.docPid,
						},
						hit: s,
						context: snippetParts(s, this.mainAnnotation.id, this.dir),

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
	},
})

</script>