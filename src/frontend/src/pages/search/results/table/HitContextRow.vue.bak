<template>
	<tr class="concordance-details">
		<td :colspan="colspan">
			<!-- <DepTree :hit="rowData"/> -->
			<p v-if="data.loading">
				<span class="fa fa-spinner fa-spin"></span> Loading...
			</p>
			<p v-if="data.error" class="text-danger">
				<span class="fa fa-exclamation-triangle"></span> <span v-html="data.error"></span>
			</p>
			<template v-else-if="context && data.citation">
				<p>
					<template v-for="addon in data.addons">
						<component v-if="addon.component"
							:is="addon.component"
							:key="addon.name"
							:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
							v-bind="addon.props"
							v-on="addon.listeners"
						>
							<div v-if="addon.content" v-html="addon.content"></div>
						</component>

						<component v-else
							:is="addon.element || 'div'"
							:key="addon.name"
							:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
							v-bind="addon.props"
							v-on="addon.listeners"
							v-html="addon.content"
						/>
					</template>

					<HitContextComponent tag="span" :dir="dir" :data="context.before" :html="html"/>
					<HitContextComponent tag="strong" :dir="dir" :data="context.match" :html="html"/>
					<a :href="data.href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
					<HitContextComponent tag="span" :dir="dir" :data="context.after" :html="html"/>



					<!-- <span :dir="dir">
						<template v-if="html">
							<span v-html="data.citation.left"></span>
							<strong v-html="data.citation.hit"></strong>
							<a :href="data.href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
							<span v-html="data.citation.right"></span>
						</template>
						<template v-else>
							<span>{{data.citation.left}}</span>
							<strong>{{data.citation.hit}}</strong>
							<a :href="data.href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
							<span>{{data.citation.right}}</span>
						</template>
					</span> -->
				</p>

				<div v-if="otherAnnotations.length" style="overflow: auto; max-width: 100%; padding-bottom: 15px;">
					<table class="concordance-details-table">
						<thead>
							<tr>
								<th>Property</th>
								<th :colspan="data.citation.match.punct.length">Value</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="annot in otherAnnotations" :key="annot.id">
								<th>{{annot.displayName}}</th>
								<td v-for="(v, index) in data.citation.match[annot.id]" :key="index">{{v}}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import * as UIStore from '@/store/search/ui';
import { HitContext, NormalizedAnnotation } from '@/types/apptypes';
import HitContextComponent from './HitContext.vue';
import { snippetParts } from '@/utils';

export type CitationRowData = {
	open: boolean;
	loading: boolean;
	error?: null|string;
	citation: null|BLTypes.BLHitSnippet;
	addons: Array<ReturnType<UIStore.ModuleRootState['results']['hits']['addons'][number]>> // todo give type a name and export separately
	href: string;
};

export default Vue.extend({
	components: {
		HitContextComponent,
	},
	props: {
		data: Object as () => CitationRowData,
		html: Boolean,
		colspan: Number,
		dir: String as () => 'ltr'|'rtl',
		mainAnnotation: String,
		otherAnnotations: Array as () => NormalizedAnnotation[],
	},
	computed: {
		context(): HitContext|null {
			return this.data.citation && snippetParts(this.data.citation, this.mainAnnotation, this.dir);
		}
	}
});
</script>

