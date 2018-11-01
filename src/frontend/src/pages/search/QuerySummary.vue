<template>
	<div class="querysummary" ref="root">
		Results for: <span class="small text-muted content" :title="summary">{{summary.substr(0, 1000)}}</span>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as formStore from '@/store/form'

export default Vue.extend({
	computed: {
		param(): formStore.ModuleRootState['submittedParameters'] { return formStore.get.lastSubmittedParameters(); },
		summary(): string {
			const {pattern, filters} = this.param!;

			if (!pattern && filters.length === 0) {
				return 'all documents';
			}

			const metadataString = filters.map(({id, type, values}) =>
				`${id} = [${type==='range'?`${values[0]} to ${values[1]}`:values.join(', ')}]`).join(', ');

			let ret = '';
			if (pattern) {
				ret += '"' + pattern + '"' + ' within ';
			}
			if (metadataString) {
				ret += 'documents where ' + metadataString;
			} else {
				ret += 'all documents';
			}

			return ret;
		}
	},
})
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