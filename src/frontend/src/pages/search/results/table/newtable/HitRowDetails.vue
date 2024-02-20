<template>
	<tr class="concordance-details" v-if="open">
		<td :colspan="colspan">
			<!-- <DepTree :hit="rowData"/> -->
			<p v-if="loading" :class="{'text-danger': !!error}">
				<span class="fa fa-spinner fa-spin"></span> Loading...
			</p>
			<p v-else-if="error" class="text-danger">
				<span class="fa fa-exclamation-triangle"></span> <span v-html="error"></span>
			</p>
			<p v-else-if="context"> <!-- check if context is set! We don't always have one. -->
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
				<a v-if="href" :href="href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
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
						<tr v-for="(annot, index) in otherAnnotations" :key="annot.id">
							<th>{{annot.displayName}}</th>
							<HitContextComponent tag="td" :data="otherContexts[index].match" :html="html" :dir="dir" :key="index"/>
						</tr>
					</tbody>
				</table>
			</div>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import { HitContext, NormalizedAnnotation } from '@/types/apptypes';
import HitContextComponent from './HitContext.vue';
import { getDocumentUrl, snippetParts } from '@/utils';
import { HitRowData } from './HitRow.vue';

import * as UIStore from '@/store/search/ui';
import * as Api from '@/api';
import { debugLog } from '@/utils/debug';

/** TODO disconnect from the store? */
export default Vue.extend({
	components: {
		HitContextComponent,
	},
	props: {
		data: Object as () => HitRowData,
		query: Object as () => BLTypes.BLSearchParameters|undefined,

		html: Boolean,
		colspan: Number,
		dir: String as () => 'ltr'|'rtl',
		mainAnnotation: Object as () => NormalizedAnnotation,
		otherAnnotations: Array as () => NormalizedAnnotation[],

		open: Boolean
	},
	data: () => ({
		loading: false,
		error: null as null|string,
		context: null as null|HitContext,
		addons: [] as Array<ReturnType<UIStore.ModuleRootState['results']['hits']['addons'][number]>>,

		initialized: false,
	}),
	computed: {
		href(): string|undefined {
			// we don't always have full-fledged hit objects here.
			// If we're rendering the hits in a document search response
			// they won't contain the start/end/parent document.
			// in that case, don't bother with the url.
			if (!('start' in this.data.hit)) return;
			return getDocumentUrl(this.data.doc.docPid, this.query?.patt, this.query?.pattgapdata, this.data.hit.start, PAGE_SIZE, this.data.hit.start);
		},
		otherContexts(): HitContext[] {
			return this.otherAnnotations.map(a => snippetParts(this.data.hit, a.id, this.dir) || []);
		},
	},
	watch: {
		open: {
			immediate: true,
			handler() {
				if (!this.open || this.initialized) return;
				if (!('start' in this.data.hit)) {
					// we don't have a fat hit. We can't get any larger context.
					// Don't do anything else, we just won't render the larger context.
					// The small table will still be shown.
					return;
				}

				ga('send', 'event', 'results', 'snippet/load', this.data.doc.docPid);
				this.loading = true;

				const transformSnippets = UIStore.getState().results.shared.transformSnippets;
				const addons = UIStore.getState().results.hits.addons;
				const formatError = UIStore.getState().global.errorMessage;
				const concordanceSize = UIStore.getState().results.shared.concordanceSize;

				Api.blacklab
				.getSnippet(INDEX_ID, this.data.doc.docPid, this.data.hit.start, this.data.hit.end, concordanceSize)
				.then(s => {
					transformSnippets?.(s);
					this.context = snippetParts(s, this.mainAnnotation.id, this.dir);

					// Run plugins defined for this corpus (ex. a copy citation to clipboard button, or an audio player/text to speech button)
					this.addons = addons.map(a => a({
						docId: this.data.doc.docPid,
						corpus: INDEX_ID,
						document: this.data.doc.docInfo,
						documentUrl: this.href || '',
						wordAnnotationId: this.mainAnnotation.id,
						dir: this.dir,
						citation: s
					}))
					.filter(a => a != null);
				})
				.catch((err: Api.ApiError) => {
					this.error = formatError(err, 'snippet');
					if (err.stack) debugLog(err.stack);
					ga('send', 'exception', { exDescription: err.message, exFatal: false });
				})
				.finally(() => this.loading = false);
			}
		}
	}
});
</script>

