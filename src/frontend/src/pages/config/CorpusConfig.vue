<template>
	<div>
		<span v-if="loading" class="fa fa-spinner fa-spin fa-4x"></span>
		<div v-else>
			<POS style="border: 1px solid red; border-radius: 3px;" :index="index"/>
		</div>
	</div>
</template>

<script lang="ts">
import { blacklab } from '@/api';
import { NormalizedIndex } from '@/types/apptypes';
import Vue from 'vue';

import POS from './POS.vue';

export default Vue.extend({
	components: {
		POS
	},
	props: {
		id: String
	},
	data: () => ({
		index: null as null|NormalizedIndex,
		loading: false,
		error: null as null|string
	}),
	computed: {

	},
	methods: {
		load() {
			this.loading = true;
			blacklab.getCorpus(this.id)
			.then(c => this.index = c)
			.catch(e => this.error = e.message)
			.finally(() => this.loading = false)
		}
	},
	created() {
		this.load();
	}
})
</script>