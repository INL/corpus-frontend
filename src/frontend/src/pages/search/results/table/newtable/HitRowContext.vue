<template>
	<tr class="concordance-details" v-if="open">
		<td :colspan="colspan">
			<!-- <DepTree :hit="rowData"/> -->
			<p v-if="loading">
				<span class="fa fa-spinner fa-spin"></span> Loading...
			</p>
			<p v-if="error" class="text-danger">
				<span class="fa fa-exclamation-triangle"></span> <span v-html="error"></span>
			</p>
			<template v-else-if="context">
				<p>
					<template v-for="addon in addons">
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
					<a :href="href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
					<HitContextComponent tag="span" :dir="dir" :data="context.after" :html="html"/>
				</p>

				<div v-if="otherAnnotations.length" style="overflow: auto; max-width: 100%; padding-bottom: 15px;">
					<table class="concordance-details-table">
						<thead>
							<tr>
								<th>Property</th>
								<th :colspan="data.hit.match.punct.length">Value</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="annot in otherAnnotations" :key="annot.id">
								<th>{{annot.displayName}}</th>
								<td v-for="(v, index) in data.hit.match[annot.id]" :key="index">{{v}}</td>
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
import { getDocumentUrl, snippetParts } from '@/utils';
import { HitRowData } from '@/pages/search/results/table/HitRow.vue';

import * as Api from '@/api';

type CitationRowData = {
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
		data: Object as () => HitRowData,
		query: Object as () => BLTypes.BLSearchParameters,

		html: Boolean,
		colspan: Number,
		contextSize: Number,
		dir: String as () => 'ltr'|'rtl',
		mainAnnotation: Object as () => NormalizedAnnotation,
		otherAnnotations: Array as () => NormalizedAnnotation[],

		open: Boolean
	},
	data: ({
		open: false,
		loading: false,
		error: null,
		citation: null as null|BLTypes.BLHitSnippet,
		addons: [] as Array<ReturnType<UIStore.ModuleRootState['results']['hits']['addons'][number]>>,

		initialized: false,
	}),
	computed: {
		href(): string {
			return getDocumentUrl(
				this.data.hit.docPid,
				this.query.patt,
				this.query.pattgapdata,
				this.data.hit.start,
				PAGE_SIZE,
				this.data.hit.start
			);
		},
		context(): undefined|HitContext {
			return this.citation ? snippetParts(this.citation, this.mainAnnotation.id, this.dir) : undefined;
		}
	},
	watch: {
		open: {
			immediate: true,
			handler() {
				if (!this.open || this.initialized) return;

				ga('send', 'event', 'results', 'snippet/load', this.data.hit.docPid);

				Api.blacklab
				.getSnippet(INDEX_ID, this.data.hit.docPid, this.data.hit.start, this.data.hit.end, this.contextSize)
				.then(s => {
					if (this.transformSnippets) {
						this.transformSnippets(s);
					}
					citation.citation = s;
					// Run plugins defined for this corpus (ex. a copy citation to clipboard button, or an audio player/text to speech button)
					citation.addons = UIStore.getState().results.hits.addons
						.map(a => a({
							docId: row.hit.docPid,
							corpus: INDEX_ID,
							document: this.results.docInfos[row.hit.docPid],
							documentUrl: citation.href,
							wordAnnotationId: this.concordanceAnnotationId,
							dir: this.textDirection,
							citation: citation.citation!
						}))
						.filter(a => a != null);
				})
				.catch((err: AppTypes.ApiError) => {
					citation.error = UIStore.getState().global.errorMessage(err, 'snippet');
					debugLog(err.stack);
					ga('send', 'exception', { exDescription: err.message, exFatal: false });
				})
				.finally(() => citation.loading = false);
				}
		}

	}

});
</script>

