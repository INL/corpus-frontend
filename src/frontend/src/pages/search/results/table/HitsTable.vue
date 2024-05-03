<template>
	<table class="hits-table">
		<thead>
			<tr class="rounded">
				<th class="text-right">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							{{leftLabel}} hit
							<span class="caret"></span>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`${beforeField}:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>{{leftLabel}} hit</template>
				</th>

				<th class="text-center">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							Hit
							<span class="caret"/>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`hit:${annotation.id}`)" class="sort" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>Hit</template>
				</th>

				<th class="text-left">
					<span v-if="sortableAnnotations && sortableAnnotations.length" class="dropdown">
						<a role="button" data-toggle="dropdown" :class="['dropdown-toggle', {'disabled': disabled}]">
							{{rightLabel}} hit
							<span class="caret"></span>
						</a>

						<ul class="dropdown-menu" role="menu">
							<li v-for="annotation in sortableAnnotations" :key="annotation.id" :class="{'disabled': disabled}">
								<a @click="changeSort(`${afterField}:${annotation.id}`)" :class="['sort', {'disabled':disabled}]" role="button">{{annotation.displayName}} <Debug>(id: {{annotation.id}})</Debug></a>
							</li>
						</ul>
					</span>
					<template v-else>{{rightLabel}} hit</template>
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
		<tbody>
			<template v-for="(h, i) in data">
				<template v-if="h.type === 'hit'">
					<HitRow :key="`${i}-hit`"
						:class="{open: open[i], interactable: !disableDetails && !disabled}"
						:data="h"
						:displayField="isParallel ? parallelVersion(annotatedField) : ''"
						:mainAnnotation="mainAnnotation"
						:otherAnnotations="otherAnnotations"
						:metadata="metadata"
						:dir="dir"
						:html="html"
						:disabled="disabled"
						@click.native="!disableDetails && $set(open, i, !open[i])"
					/>

					<HitRowDetails v-if="!disableDetails" :key="`${i}-details`"
						:colspan="colspan"
						:data="h"
						:open="open[i]"
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
							:class="{open: open[i], interactable: !disableDetails && !disabled}"
							class="foreign-hit"
							:data="of.hit"
							:displayField="isParallel ? parallelVersion(of.name) : ''"
							:mainAnnotation="mainAnnotation"
							:otherAnnotations="otherAnnotations"
							:metadata="metadata"
							:dir="dir"
							:html="html"
							:disabled="disabled"
							@click.native="!disableDetails && $set(open, i, !open[i])"
						/>
						<HitRowDetails v-if="!disableDetails" :key="`${i}-${of.name}-details`"
							:colspan="colspan"
							:data="of.hit"
							:open="open[i]"
							:query="query"
							:annotatedField="of.name"
							:mainAnnotation="mainAnnotation"
							:detailedAnnotations="detailedAnnotations"
							:dir="dir"
							:html="html"
						/>
					</template>

				</template>
				<DocRow v-else :key="`${i}-doc`"
					:data="h"
					:metadata="metadata"
					:colspan="colspan"
				/>
			</template>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { BLDocInfo, BLHit, BLHitSnippet, BLSearchParameters } from '@/types/blacklabtypes';

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
	data: () => ({
		open: {} as Record<string, boolean>
	}),
	computed: {
		// ltr, rtl stuff
		leftLabel(): string { return this.dir === 'rtl' ? 'After' : 'Before'; },
		rightLabel(): string { return this.dir === 'rtl' ? 'Before' : 'After'; },
		beforeField(): string { return this.dir === 'rtl' ? 'after' : 'before'; },
		afterField(): string { return this.dir === 'rtl' ? 'before' : 'after'; },
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
			const prefix = CorpusStore.get.parallelFieldPrefix();
			const selectedTargets = QueryStore.getState().parallelVersions?.targets || [];
			const otherFieldsInOrder = selectedTargets.length > 0 ? selectedTargets :
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
						hit,

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
	watch: {
		data() {
			this.open = {};
		}
	}
})

</script>