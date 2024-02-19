<template>
	<tr class="grouprow rounded interactable">
		<td v-for="col in columns" :key="col.toString()">
			<template v-if="typeof col === 'string'">
				<template v-if="col.indexOf('relative') === -1">{{data[col] != null ? data[col].toLocaleString() : '[unknown]'}}</template> <!-- HACK! all division keys contain spaces for now, probably pretty slow too -->
				<template v-else>{{data[col] != null ? frac2Percent(data[col]) : '[unknown]'}}</template>
			</template>

			<div v-else class="progress group-size-indicator">
				<div class="progress-bar progress-bar-primary"
					:style="{
						'min-width': data[col[0]] ? frac2Percent(data[col[0]] / maxima[col[0]]) : '100%',
						'opacity': data[col[0]] ? 1 : 0.5
					}">{{data[col[1]] ? data[col[1]].toLocaleString() : '[unknown]'}}</div>
			</div>
		</td>
	</tr>
</template>

<script lang="ts">
import Vue from 'vue';

import frac2Percent from '@/mixins/fractionalToPercent';
import { GroupRowdata } from '@/pages/search/results/table/groupTable';

export default Vue.extend({
	props: {
		columns: Array as () => Array<keyof GroupRowdata|[keyof GroupRowdata, keyof GroupRowdata]>,
		data: Object as () => GroupRowdata,
		maxima: Object as () => Record<keyof GroupRowdata, number>,
	},
	methods: {
		frac2Percent
	},
});
</script>

<style lang="scss" scoped>
</style>