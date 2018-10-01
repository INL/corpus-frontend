<template>
	<div class="lightbg haspadding resultcontainer">
		<GroupResults v-if="isGroups" :results="results"/>
		<HitResults v-if="isHits" :results="results"/>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';

import * as BLTypes from '@/types/blacklabtypes';

import GroupResults from '@/pages/search/GroupResults.vue';
import HitReulsts from '@/pages/search/HitResults.vue';

export default Vue.extend({
	components: {
		GroupResults
	},
	props: {
		results: Object as () => BLTypes.BLSearchResult|null
	},
	computed: {
		isGroups(): boolean { return BLTypes.isGroups(this.results); },
		isHits(): boolean { return BLTypes.isHitResults(this.results); },
		isDocs(): boolean { return BLTypes.isDocResults(this.results); },
	}
});
</script>

<style lang="scss">
</style>

