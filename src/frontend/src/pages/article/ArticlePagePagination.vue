<template>
	<div v-if="shouldRender" class="article-pagination">
		<span v-if="loading" class="fa fa-spinner fa-spin fa-4x"></span>
		<template v-else>
			<template v-if="pageSize != null">
				<div class="pagination-container">
					<label>Pages</label>
					<div class="pagination-wrapper">
						<Pagination v-bind="paginationInfo" :editable="false" :showOffsets="false" @change="handlePageNavigation"/>
					</div>
				</div>
				<hr>
			</template>
			<div v-if="hits.length" class="pagination-container">
				<label>Hits</label>
				<div class="pagination-wrapper">
					<Pagination v-bind="hitInfo" :editable="false" :showOffsets="false" @change="handleHitNavigation"/>
				</div>
			</div>
		</template>
	</div>
</template>

<script lang="ts">

import Vue from 'vue';
import URI from 'urijs';

import * as RootStore from '@/store/article';
import { MapOf, words } from '@/utils';
import { blacklab } from '@/api';
import { BLHitResults } from '@/types/blacklabtypes';

import Pagination from '@/components/Pagination.vue';

// see article.vm
declare const INDEX_ID: string;
declare const DOCUMENT_ID: string;
declare const PAGESIZE: number|null;

// NOTE: wordend is exclusive (wordstart=0 && wordend=100 returns words at index 0-99)

// NOTE: this is a ugly piece of code, but hey it works /shrug
export default Vue.extend({
	components: { Pagination },
	data: () => ({
		pageSize: PAGESIZE,
		hits: null as null|Array<[number, number]>,
		hitElements: [...document.querySelectorAll('.hl')] as HTMLElement[],
		currentHitInPage: undefined as number|undefined,
	}),
	computed: {
		shouldRender(): boolean {
			return this.pageSize != null || // pagination enabled
				(this.hits && this.hits.length) || // hits found
				!!this.hits == null && new URI().search(true).patt // hits being fetched
		},

		document: RootStore.get.document,
		docLength(): number { return this.document ? this.document.docInfo.lengthInTokens : 1 ; },

		loading(): boolean { return this.document == null || this.hits == null; },

		currentPageInfo(): {wordstart: number, wordend: number} {
			if (!this.pageSize || this.document == null) { return {wordstart: 0, wordend: 1}; }
			let { wordstart, wordend } = new URI().search(true);

			// fallback to defaults if nan, clamp to document size
			wordstart = Number(wordstart) || 0;
			wordend = Number(wordend) || this.pageSize;
			wordstart = wordstart >= 0 ? wordstart <= this.docLength ? wordstart : this.docLength! : 0;
			wordend = wordend >= 0 ? wordend <= this.docLength ? wordend : this.docLength! : this.pageSize;

			return {wordstart, wordend}
		},
		firstVisibleHitIndex(): number {
			if (this.loading || !this.pageSize) { return 0; }
			const firstVisibleHitIndex = this.hits!.findIndex(([start, end]) => start >= this.currentPageInfo.wordstart);
			return firstVisibleHitIndex;
		},
		currentHitIndex(): number|undefined { return this.currentHitInPage ? (this.firstVisibleHitIndex + this.currentHitInPage) : undefined; },

		paginationInfo(): undefined|{
			page: number,
			maxPage: number,
			minPage: number,
			disabled: boolean,
			pageActive: boolean
		} {
			if (this.loading || !this.pageSize) { return undefined; }

			const {wordstart, wordend} = this.currentPageInfo;

			const isOnExactPage = (wordstart % this.pageSize) === 0 && ((wordend - this.pageSize) === wordstart);
			return {
				page: Math.floor(this.currentPageInfo.wordstart / this.pageSize),
				maxPage: Math.floor(this.docLength / this.pageSize),
				minPage: 0,
				disabled: false,
				pageActive: isOnExactPage
			}
		},
		hitInfo(): undefined|{
			page: number,
			maxPage: number,
			minPage: number,
			disabled: boolean,
			pageActive: boolean
		} {
			if (this.loading || !this.hits || !this.hits.length) { return undefined; }

			const isOnHit = this.currentHitInPage != null;
			return {
				page: this.currentHitIndex || this.firstVisibleHitIndex,
				maxPage: this.hits!.length-1,
				minPage: 0,
				disabled: false,
				pageActive: isOnHit
			}
		},
	},
	methods: {
		handlePageNavigation(page: number, hit?: number) {
			let wordstart: number|undefined = page * this.pageSize!;
			let wordend: number|undefined = (page + 1) * this.pageSize!;
			if (wordstart <= 0) { wordstart = undefined; }
			if (wordend >= this.docLength!) { wordend = undefined; }

			const newUrl = new URI().setSearch({wordstart, wordend}).fragment(hit != null ? hit.toString(10): '').toString();
			window.location.href = newUrl;
		},
		handleHitNavigation(index: number) {
			const indexInThisPage = index - this.firstVisibleHitIndex;
			if (indexInThisPage >= this.hitElements.length || indexInThisPage < 0) {
				const pageOfNewHit = Math.floor(this.hits![index][0] / this.pageSize!);
				const startOfNewPage = pageOfNewHit * this.pageSize!;
				const endOfNewPage = (pageOfNewHit + 1) * this.pageSize!;

				// find index in new page
				let firstHitOnNewPage = Number.MAX_SAFE_INTEGER;
				for (let n = 0; n < this.hits!.length; ++n) {
					const [s, e] = this.hits![n];
					if (s >= startOfNewPage) { firstHitOnNewPage = Math.min(firstHitOnNewPage, n); }
				}

				const indexInNewPage = index - firstHitOnNewPage;

				this.handlePageNavigation(pageOfNewHit, indexInNewPage)
				return;
			}

			if (this.currentHitInPage != null) {
				const prevHit = this.hitElements[this.currentHitInPage!];
				prevHit.classList.remove('active');
			}

			const nextHit = this.hitElements[indexInThisPage];
			nextHit.classList.add('active');
			nextHit.scrollIntoView({block: 'center', inline: 'center'});
			this.currentHitInPage = index - this.firstVisibleHitIndex;
		}
	},
	watch: {
		currentHitInPage() {
			window.history.replaceState(undefined, '', window.location.pathname + window.location.search + (this.currentHitInPage == null ? '' : `#${this.currentHitInPage.toString(10)}`));
		},

		document: {
			immediate: true,
			handler() {
				if (!this.document || this.hits != null) { return; }

				const { query } = new URI().search(true);
				const pidField = this.document!.docFields.pidField!;
				const docId = this.document.docInfo[pidField][0];

				if (!query) { // no hits when no query, abort
					this.hits = [];
					return;
				}

				blacklab.getHits(INDEX_ID, {
					filter: `${pidField}:("${docId.replace(/"/g, '\\"')}")`,
					patt: query,
					first: 0,
					number: Math.pow(2, 31)-1,
				})
				.request.then((r: BLHitResults) => r.hits.map(h => [h.start, h.end] as [number, number]))
				.then(hits => {
					// if specific hit passed from the previous page, find it in this page
					let findHit: string|undefined|number = new URI().search(true).findhit as string|undefined;
					if (findHit != null) {
						findHit = Number(findHit);

						if (!isNaN(Number(findHit))) {
							const index = hits.findIndex(hit => hit[0] === findHit);
							if (index >= 0) {
								const firstVisibleHitIndex = hits.findIndex(([start, end]) => start >= this.currentPageInfo.wordstart);
								if (this.currentHitInPage != null) {
									this.hitElements[this.currentHitInPage].classList.remove('active');
								}
								this.currentHitInPage = index - firstVisibleHitIndex;
								this.hitElements[this.currentHitInPage].classList.add('active');
								this.hitElements[this.currentHitInPage].scrollIntoView({block: 'center', inline: 'center'});
							}
						}
						window.history.replaceState(undefined, '', new URI().removeSearch('findhit').toString());
					}

					this.hits = hits;
				});
			}
		}
	},
	created() {
		// initially, highlight the correct hit, if there is any specified
		// otherwise just remove the
		if (!this.hitElements.length) {
			this.currentHitInPage = undefined;
			window.history.replaceState(undefined, '', window.location.pathname + window.location.search); // setting hash to '' won't remove '#'
			return;
		}

		let hitInPage = Number(window.location.hash ? window.location.hash.substring(1) : '0') || 0;
		if (hitInPage >= this.hitElements.length || hitInPage < 0) {
			hitInPage = 0;
		}

		this.hitElements[hitInPage].classList.add('active');
		this.hitElements[hitInPage].scrollIntoView({block: 'center', inline: 'center'});
		this.currentHitInPage = hitInPage;
	}
});
</script>

<style lang="scss">
.article-pagination {
	top: 10%;
	right: 10%;
	position: fixed;
	z-index: 1000;
	border: 1px solid #ccc;
	background: white;
	box-shadow:  0px 3px 12px -2px rgba(0,0,0,0.6);
	border-radius: 3px;

	padding: 5px;

	> hr {
		margin: 5px 0;
	}

	>.pagination-container {
		display: flex;
		flex-direction: row;
		align-items: baseline;

		> label {
			margin: 0;
			flex: 0 auto;
			width: 5em;
			min-width: 5em;
			max-width: 5em;
		}

		>.pagination-wrapper {
			display: flex;
			justify-content: center;
			align-items: baseline;
			flex-wrap: nowrap;
			flex: 1 auto;
		}
	}
}
</style>