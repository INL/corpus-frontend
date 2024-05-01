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
		<tbody>
			<template v-for="(h, i) in data">
				<template v-if="h.type === 'hit'">
					<HitRow :key="`${i}-hit`"
						:class="{open: open[i], interactable: !disableDetails && !disabled}"
						:data="h"
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
						:mainAnnotation="mainAnnotation"
						:detailedAnnotations="detailedAnnotations"
						:dir="dir"
						:html="html"
					/>
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
import { BLSearchParameters } from '@/types/blacklabtypes';

import HitRow, {HitRowData} from '@/pages/search/results/table/HitRow.vue'
import HitRowDetails from '@/pages/search/results/table/HitRowDetails.vue'
import DocRow, {DocRowData} from '@/pages/search/results/table/DocRow.vue';

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
		leftLabel(): string { return this.dir === 'rtl' ? this.$t('results.table.After') as string : this.$t('results.table.Before') as string; },
		rightLabel(): string { return this.dir === 'rtl' ? this.$t('results.table.Before') as string : this.$t('results.table.After') as string; },
		beforeField(): string { return this.dir === 'rtl' ? this.$t('results.table.after') as string : this.$t('results.table.before') as string; },
		afterField(): string { return this.dir === 'rtl' ? this.$t('results.table.before') as string : this.$t('results.table.after') as string; },
		colspan(): number {
			let c = 3; // hit, before, after
			if (this.otherAnnotations) c += this.otherAnnotations.length;
			if (this.metadata) c += this.metadata.length;
			return c;
		}
	},
	methods: {
		changeSort(sort: string) {
			this.$emit('changeSort', sort)
		},
	},
	watch: {
		data() {
			this.open = {};
		}
	}
})

</script>