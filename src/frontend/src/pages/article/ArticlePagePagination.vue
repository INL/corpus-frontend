<template>
	<div v-if="shouldRender" :class="['article-pagination', shouldRender && loading && 'loading']">
		<span v-if="loading" class="fa fa-spinner fa-spin fa-4x"></span>
		<template v-else>
			<div v-if="paginationInfo" class="pagination-container">
				<label>Pages</label>
				<div class="pagination-wrapper">
					<Pagination v-bind="paginationInfo" :editable="false" :showOffsets="false" @change="handlePageNavigation"/>
				</div>
			</div>
			<hr v-if="hitInfo && paginationInfo != null">
			<div v-if="hitInfo" class="pagination-container">
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

import { blacklab } from '@/api';
import { BLHitResults } from '@/types/blacklabtypes';

import Pagination from '@/components/Pagination.vue';
import { debugLogCat } from '@/utils/debug';

// NOTE: wordend in blacklab parameters is exclusive (wordstart=0 && wordend=100 returns words at index 0-99)

// NOTE: this is a ugly piece of code, but hey it works /shrug
export default Vue.extend({
	components: { Pagination },
	data: () => ({
		hits: null as null|Array<[number, number]>,
		hitElements: [...document.querySelectorAll('.hl')] as HTMLElement[],
		currentHitInPage: undefined as number|undefined,
		loadingForAwhile: false,
		pageSize: PAGE_SIZE
	}),
	computed: {
		shouldRender(): boolean {
			return (this.loadingForAwhile || (this.hits != null && this.hits.length > 0)) || // hits portion
			(PAGINATION_ENABLED && (PAGE_END - PAGE_START) < DOCUMENT_LENGTH)
			// return PAGINATION_ENABLED;
		},

		loading(): boolean { return this.hits == null; },

		currentPageInfo(): {wordstart: number, wordend: number} {
			return {wordstart: PAGE_START, wordend: PAGE_END};
		},
		firstVisibleHitIndex(): number {
			if (this.loading || !PAGINATION_ENABLED) { return 0; }
			const firstVisibleHitIndex = this.hits!.findIndex(([start, end]) => start >= this.currentPageInfo.wordstart);
			return firstVisibleHitIndex >= 0 ? firstVisibleHitIndex : this.hits!.length - 1;
		},
		currentHitIndex(): number|undefined { return this.currentHitInPage ? (this.firstVisibleHitIndex + this.currentHitInPage) : undefined; },

		paginationInfo(): undefined|{
			page: number,
			maxPage: number,
			minPage: number,
			disabled: boolean,
			pageActive: boolean
		} {
			if (this.loading || !PAGINATION_ENABLED) { return undefined; }

			const {wordstart, wordend} = this.currentPageInfo;

			const isOnExactPage = (wordstart % PAGE_SIZE!) === 0 && (PAGE_END === (PAGE_START + PAGE_SIZE!) || PAGE_END === DOCUMENT_LENGTH)
			return {
				page: Math.floor(this.currentPageInfo.wordstart / PAGE_SIZE!),
				maxPage: Math.floor(DOCUMENT_LENGTH / PAGE_SIZE!),
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
				page: this.currentHitIndex != null ? this.currentHitIndex : this.firstVisibleHitIndex,
				maxPage: this.hits!.length-1,
				minPage: 0,
				disabled: false,
				pageActive: isOnHit
			}
		},
	},
	methods: {
		handlePageNavigation(page: number, hit?: number) {
			let wordstart: number|undefined = page * PAGE_SIZE!;
			let wordend: number|undefined = (page + 1) * PAGE_SIZE!;
			if (wordstart <= 0) { wordstart = undefined; }
			if (wordend >= DOCUMENT_LENGTH) { wordend = undefined; }

			const newUrl = new URI().setSearch({wordstart, wordend}).fragment(hit != null ? hit.toString(10): '').toString();
			debugLogCat('history', `Setting window.location.href to ${newUrl}`);
			window.location.href = newUrl;
		},
		handleHitNavigation(index: number) {
			const indexInThisPage = index - this.firstVisibleHitIndex;
			if (indexInThisPage >= this.hitElements.length || indexInThisPage < 0) {
				const pageOfNewHit = Math.floor(this.hits![index][0] / PAGE_SIZE!);
				const startOfNewPage = pageOfNewHit * PAGE_SIZE!;
				const endOfNewPage = (pageOfNewHit + 1) * PAGE_SIZE!;

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
			const url = window.location.pathname + window.location.search + (this.currentHitInPage == null ? '' : `#${this.currentHitInPage.toString(10)}`);
			debugLogCat('history', `Calling replaceState with URL: ${url}`);
			window.history.replaceState(undefined, '', url);
		},
	},
	created() {
		// There are two ways the url can contain a reference to a specific hit we should outline/scroll to
		// first: the hash as an index (#10 for the 10th hit on this page for example - this is when someone got sent the page from someone else, or when refreshing the page)
		// second: the ?findhit parameter, contains the token offset where the hit starts

		// case 1: the nth hit on the page

		// initially, highlight the correct hit, if there is any specified
		// otherwise just remove the window hash
		if (!this.hitElements.length) {
			this.currentHitInPage = undefined;
			const url = window.location.pathname + window.location.search;
			debugLogCat('history', `Calling replaceState with URL: ${url}`);
			window.history.replaceState(undefined, '', url); // setting hash to '' won't remove '#'
		} else {
			let hitInPage = Number(window.location.hash ? window.location.hash.substring(1) : '0') || 0;
			if (hitInPage >= this.hitElements.length || hitInPage < 0) {
				hitInPage = 0;
			}

			this.hitElements[hitInPage].classList.add('active');
			this.hitElements[hitInPage].scrollIntoView({block: 'center', inline: 'center'});
			this.currentHitInPage = hitInPage;
		}


		// now request all hits from blacklab, we need this to solve the second case with the ?findhit parameter, but also so we know whether there are more hits
		// outside this page (so we can navigate the user there).


		// Load all hits in the document (also those outside this page)
		// @ts-ignore
		const { query }: { query: string|undefined } = new URI().search(true);

		if (!query) { // no hits when no query, abort
			this.hits = [];
			return;
		}

		const spinnerTimeout = setTimeout(() => this.loadingForAwhile = true, 3000);
		blacklab
		.getHits(INDEX_ID, {
			docpid: DOCUMENT_ID,
			patt: query,
			first: 0,
			number: Math.pow(2, 31)-1,
			context: 0,
			includetokencount: false,
			listvalues: "__do_not_send_anything__", // we don't need this info
		}).request
		.then((r: BLHitResults) => r.hits.map(h => [h.start, h.end] as [number, number]))
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
				const url = new URI().removeSearch('findhit').toString();
				debugLogCat('history', `Calling replaceState with URL: ${url}`);
				window.history.replaceState(undefined, '', url);
			}

			this.hits = hits;
		})
		.finally(() => { clearTimeout(spinnerTimeout);  this.loadingForAwhile = false; });
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

	&.loading {
		border-radius: 50%;
	}

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