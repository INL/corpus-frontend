<template>
	<tr class="concordance-details" v-if="open">
		<td :colspan="colspan">
			<div style="overflow: auto; max-width: 100%;">
				<p v-if="loading" :class="{'text-danger': !!error}">
					<span class="fa fa-spinner fa-spin"></span> {{$t('results.table.loading')}}
				</p>
				<p v-else-if="error" class="text-danger">
					<span class="fa fa-exclamation-triangle"></span> <span v-html="error"></span>
				</p>
				<template v-else-if="context"> <!-- context is the larger surrounding context of the hit. We don't always have one (when rendering docs we only have the immediate hit and no context, so this is meaningless.) -->
					<DepTree
						:data="data"
						:canLoadFullSentence="!!canLoadSentence"
						:fullSentence="sentenceSnippet"
						:loadingFullSentence="loadingSentenceSnippet"
						:mainAnnotation="mainAnnotation.id"
						:otherAnnotations="{
							lemma: 'lemma',
							upos: 'pos',
							// xpos: 'xpos',
						}"
						@loadSentence="loadSentence"
					/>
					<p>
						<template v-for="addon in addons">
							<component v-if="addon.component"
								:is="addon.component"
								:key="addon.name + '_vue'"
								:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
								v-bind="addon.props"
								v-on="addon.listeners"
							>
								<div v-if="addon.content" v-html="addon.content"></div>
							</component>

							<component v-else
								:is="addon.element || 'div'"
								:key="addon.name + '_html'"
								:class="`addon addon-${addon.name} ${(addon.props && addon.props.class) || ''}`"
								v-bind="addon.props"
								v-on="addon.listeners"
								v-html="addon.content"
							/>
						</template>

						<HitContextComponent tag="span" :dir="dir" :data="context.before" :html="html" before/>
						<HitContextComponent tag="strong" :dir="dir" :data="context.match" :html="html"/>
						<a v-if="href" :href="href" title="Go to hit in document" target="_blank"><sup class="fa fa-link" style="margin-left: -5px;"></sup></a>
						<HitContextComponent tag="span" :dir="dir" :data="context.after" :html="html" after/>
					</p>
				</template>
				<template v-else-if="!detailedAnnotations?.length">
					<p>{{$t('results.table.noContext')}}</p>
				</template>

				<div v-if="detailedAnnotations?.length" class="concordance-details-wrapper">
					<table class="concordance-details-table">
						<thead>
							<tr>
								<th>{{$t('results.table.property')}}</th>
								<th :colspan="data.hit.match.punct.length">{{$t('results.table.value')}}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(annot, index) in detailedAnnotations" :key="annot.id">
								<th>{{annot.displayName}}</th>
								<HitContextComponent v-for="(token, ti) in otherContexts[index].match" tag="td" :data="[token]" :html="html" :dir="dir" :key="annot.id + ti" :punct="false"/>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import { HitContext, NormalizedAnnotation } from '@/types/apptypes';
import HitContextComponent from '@/pages/search/results/table/HitContext.vue';
import { getDocumentUrl } from '@/utils';
import { snippetParts } from '@/utils/hit-highlighting';
import { HitRowData } from '@/pages/search/results/table/HitRow.vue';
import DepTree from '@/pages/search/results/table/DepTree.vue';

import * as UIStore from '@/store/search/ui';
import * as Api from '@/api';
import { debugLog } from '@/utils/debug';

/** TODO disconnect from the store? */
export default Vue.extend({
	components: {
		HitContextComponent,
		DepTree
	},
	props: {
		data: Object as () => HitRowData,
		query: Object as () => BLTypes.BLSearchParameters|undefined,

		annotatedField: {
			type: String,
			default: '',
		},
		mainAnnotation: Object as () => NormalizedAnnotation,
		detailedAnnotations: Array as () => NormalizedAnnotation[]|undefined,

		html: Boolean,
		colspan: Number,
		dir: String as () => 'ltr'|'rtl',

		open: Boolean
	},
	data: () => ({
		loading: false,
		error: null as null|string,
		context: null as null|HitContext,
		/** Required for deptree, since sometimes relations point outside the matched hit, so provide as much info as possible. */
		snippet: null as null|BLTypes.BLHitSnippet,
		addons: [] as Array<ReturnType<UIStore.ModuleRootState['results']['hits']['addons'][number]>>,

		initialized: false,

		loadingSentenceSnippet: false,
		sentenceSnippet: null as null|BLTypes.BLHit,
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
			return (this.detailedAnnotations || []).map(a => snippetParts(this.data.hit, a.id, this.dir, false) || []);
		},
		canLoadSentence(): boolean { return !!UIStore.getState().search.shared.within.sentenceElement; }
	},
	methods: {
		/**
		 * Separate from the snippet/context, as that can run over sentence boundaries, but this doesn't.
		 * We use it to render the dependency tree for the entire sentence.
		 */
		loadSentence() {
			if (this.sentenceSnippet || this.loadingSentenceSnippet || !('start' in this.data.hit)) return;
			const context = UIStore.getState().search.shared.within.sentenceElement;
			if (!context) return; // unavailable.

			this.loadingSentenceSnippet = true;
			Api.blacklab.getSnippet(
				INDEX_ID,
				this.data.doc.docPid,
				this.annotatedField,
				this.data.hit.start,
				this.data.hit.end,
				context
			)
			.then(r => this.sentenceSnippet = r)
			.catch(e => this.error = e.message)
			.finally(() => this.loadingSentenceSnippet = false);
		}
	},
	watch: {
		open: {
			immediate: true,
			handler() {
				if (!this.open || this.initialized) return;
				if (!('start' in this.data.hit)) {
					// we don't have a fat hit. We can't get any larger context (because we don't know the start/end of the hit)
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
				.getSnippet(INDEX_ID, this.data.doc.docPid, this.annotatedField, this.data.hit.start, this.data.hit.end, concordanceSize)
				.then(s => {
					transformSnippets?.(s);
					this.context = snippetParts({
						// matchInfos not included in document search results. If we're expanding one of those context,
						// @ts-ignore
						matchInfos: s.matchInfos || this.data.hit.matchInfos,
						...s
					}, this.mainAnnotation.id, this.dir);
					this.snippet = s;

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

<style lang="scss">

$screen-xs: 480px;
$screen-sm: 768px;
$screen-md: 992px;
$screen-lg: 1200px;


.concordance-details-wrapper {
	overflow-x: auto;
	max-width: calc(100vw - 125px);
	@media(max-width: $screen-md - 1px) { max-width: calc(100vw - 100px); }
}
.concordance-details-table {
	table-layout: auto;

	td {
		padding: 0 0.25em;
	}
}

.container:not(.container-fluid) .concordance-details-table {
	@media(min-width: $screen-xs) { max-width: calc($screen-xs - 75px); }
	@media(min-width: $screen-sm) { max-width: calc($screen-sm - 100px); }
	@media(min-width: $screen-md) { max-width: calc($screen-md - 125px); }
	@media(min-width: $screen-lg) { max-width: calc($screen-lg - 125px); }
}

</style>