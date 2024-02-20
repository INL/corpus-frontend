<template>
	<table class="hits-table">
		<thead>
			<tr class="rounded">
				<th class="text-right">
					<span v-if="sortableAnnotations.length" class="dropdown">
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
					<span v-if="sortableAnnotations.length" class="dropdown">
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
					<span v-if="sortableAnnotations.length" class="dropdown">
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
				<HitRow :key="i"
					:data="data"
					:mainAnnotation="mainAnnotation"
					:otherAnnotations="otherAnnotations"
					:metadata="metadata"
					:dir="dir"
					:html="html"
					:disabled="disabled"
				/>

				<HitRowContext :key="i"
					:data="data"
					:annotation="mainAnnotation"
					:otherAnnotations="otherAnnotations"
					:dir="dir"
					:html="html"
				/>
			</template>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';
import { NormalizedAnnotation, NormalizedMetadataField } from '@/types/apptypes';
import { BLDoc, BLHit, BLHitSnippet, BLSearchParameters } from '@/types/blacklabtypes';
import { GlossFieldDescription } from '@/store/search/form/glossStore';
import { CitationRowData } from '@/pages/search/results/table/HitContextRow.vue';

export type HitRowData = {
	type: 'hit';
	/** We might only have partial hits, if the parent of this hit was a document. */
	hit: BLHit|BLHitSnippet;
	doc?: BLDoc;

	// TODO jesse
	gloss_fields: GlossFieldDescription[];
	hit_first_word_id: string; // Jesse
	hit_last_word_id: string // jesse
	hit_id: string; // jesse
}

export default Vue.extend({
	props: {
		/** To generate links to the source document with the correct query, etc. */
		query: Object as () => BLSearchParameters,
		// what is the main text to show in the column
		mainAnnotation: Object as () => NormalizedAnnotation,
		/** Optional */
		otherAnnotations: Array as () => NormalizedAnnotation[],
		/** Optional */
		metadata: Array as () => NormalizedMetadataField[],
		/** Optional */
		sortableAnnotations: Array as () => NormalizedAnnotation[],

		dir: String as () => 'ltr'|'rtl',
		/** Render contents as html or text */
		html: Boolean,
		/** Prevent interaction with sorting, expanding/collapsing, etc. */
		disabled: Boolean,

		/** The results */
		data: Array as () => HitRowData[],
	},
	data: () => ({
		contexts: {} as Record<number, CitationRowData>
	}),
	computed: {
		// ltr, rtl stuff
		leftLabel(): string { return this.dir === 'rtl' ? 'After' : 'Before'; },
		rightLabel(): string { return this.dir === 'rtl' ? 'Before' : 'After'; },
		beforeField(): string { return this.dir === 'rtl' ? 'after' : 'before'; },
		afterField(): string { return this.dir === 'rtl' ? 'before' : 'after'; },
	},
	methods: {
		changeSort(sort: string) {
			this.$emit('changeSort', sort)
		},
		openContext(i: number) {
			if (!this.contexts[i]) {
				const newContext: CitationRowData = {
					addons: [],
					citation: null,
					href: '',
					loading: false,
					open: false,
					error: null
				}
			}

			this.$set(this.contexts, i, {
				open: true,
				data: this.data[i],
			});
		},
	},
	watch: {
		data() {
			this.contexts = {};
		}
	}
})

</script>