<template>
	<span class="filter-overview" v-if="filters.length">
		<span v-for="filter in filters" :key="filter.id">{{filter.displayName}}: <i>{{filter.values.join(', ')}}</i>&nbsp;</span>
	</span>
</template>

<script lang="ts">
import Vue from 'vue';

import * as formStore from '@/store/form';
import * as corpusStore from '@/store/corpus';

import * as BLTypes from '@/types/blacklabtypes';
import * as PageTypes from '@/types/pagetypes';

type ExtendedFilter = {
	id: string;
	values: string[];
	displayName: string;
}

export default Vue.extend({
	computed: {
		filters(): ExtendedFilter[] {
			const metadataFields = corpusStore.getState().metadataFields;
			return formStore.get.activeFilters().map(f => {
				const {displayName, displayValues} = metadataFields[f.id];

				return {
					...f,
					displayName,
					values: f.values.map(value => displayValues[value] != null ? displayValues[value] : value)
				}
			})
		}
	}
});

</script>

<style lang="scss" scoped>
.filter-overview {
	color: #888888;
	font-size: 85%;
	padding-left: 1px;
}
</style>