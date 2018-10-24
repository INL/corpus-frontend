<template>
	<div class="querysummary">
		<div class="col-xs-12">
			Results for: <span class="small text-muted content" :title="summary">{{summary.substr(0, 1000)}}</span>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as formStore from '@/store/form'

import { getQuerySummary } from '@/modules/singlepage-bls';

export default Vue.extend({
	computed: {
		summary() {
			return getQuerySummary(formStore.get.lastSubmittedParameters())
		}
	},
})
</script>

<style lang="scss">

.querysummary {
	background: white;
	font-size: 18px;
	padding: 8px 0px;
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