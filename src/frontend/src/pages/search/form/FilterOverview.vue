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
import * as AppTypes from '@/types/apptypes';

type ExtendedFilter = {
	id: string;
	values: string[];
	displayName: string;
}

export default Vue.extend({
	computed: {
		// whatever, this will be cached.
		// todo tidy up
		metadataValueMaps(): {[fieldId: string]: {[value: string]: string; }} {
			return Object.values(corpusStore.getState().metadataFields)
			.reduce((acc, field: AppTypes.NormalizedMetadataField) => {
				acc[field.id] = (field.values || [])!.reduce((acc, val) => {
					acc[val.value] = val.label;
					return acc;
				}, {} as {[key: string]: string})
				return acc;
			}, {} as {[key:string]: {[key: string]: string}})
		},

		filters(): ExtendedFilter[] {
			const metadataFields = corpusStore.getState().metadataFields;
			return formStore.get.activeFilters().map(f => {
				const {displayName} = metadataFields[f.id];

				const displayValues = this.metadataValueMaps[f.id] || {};

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