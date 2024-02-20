<template>
	<table>
		<thead>
			<tr>
				<th style="width: 80%">Document</th>
				<th style="width: 20%" v-if="data[0].doc.numberOfHits">Hits</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="(doc, index) in data" :key="index">
				<td><a :href="doc.href" target="_blank">{{doc.summary}}</a></td>
				<td v-if="doc.doc.numberOfHits"><strong>{{doc.doc.numberOfHits}}</strong></td>
			</tr>
		</tbody>
	</table>
</template>

<script lang="ts">
import Vue from 'vue';

import {DocRowData} from './DocRow.vue';

export default Vue.extend({
	props: {
		data: Object as () => DocRowData[],
	},
});
</script>

