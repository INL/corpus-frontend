<template>
	<div>doc results here</div>
</template>

<script lang="ts">
import Vue from 'vue';
import { BLDocResults } from 'types/blacklabtypes';

export default Vue.extend({
	props: {
		results: Object as () => BLDocResults
	}
})
</script>

<style lang="scss">

</style>