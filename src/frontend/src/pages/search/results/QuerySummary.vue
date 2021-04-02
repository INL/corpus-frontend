<template>
	<div class="querysummary" ref="root">
		Results for: <span class="small text-muted content" :title="summary">{{summary.substr(0, 1000)}}</span>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as QueryStore from '@/store/search/query';

export default Vue.extend({
	computed: {
		filters() { return Object.values(QueryStore.getState().filters  || {}); },
		cqlPattern(): string|undefined { return QueryStore.get.patternString(); },
		summary(): string {

			if (!this.cqlPattern && this.filters.length === 0) {
				return 'all documents';
			}

			const metadataString = QueryStore.get.filterSummary();

			let ret = '';

			if (this.cqlPattern) {
				ret += '"' + this.cqlPattern + '"' + ' within ';
			}
			if (metadataString) {
				ret += 'documents where ' + metadataString;
			} else {
				ret += 'all documents';
			}

			return ret;
		}
	},
});
</script>

<style lang="scss">

.querysummary {
	background: white;
	font-size: 18px;
	padding: 8px 20px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;

	> .content {
		flex-grow: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-left: 0.35em;
	}
}
</style>