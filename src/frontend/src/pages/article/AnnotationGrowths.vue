<template>
	<highcharts v-if="snippet" :options="chartOptions"/>
</template>

<script lang="ts">
export {default} from './annotationGrowths';
</script>

<style lang="scss">
.highcharts-tooltip table {
	table-layout: auto;
	width: auto;

	td {
		padding: 4px 6px;
	}
}
</style>