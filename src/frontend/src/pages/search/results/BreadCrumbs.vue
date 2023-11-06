<template>
	<ol class="breadcrumb resultscrumb">
		<!-- no disabled state; use active class instead... -->
		<li v-for="(crumb, index) in crumbs" :key="index" :class="{'active': crumb.active || disabled}">
			<a v-if="!crumb.active && !disabled"
				role="button"
				:title="crumb.title"
				:disabled="disabled"
				:class="disabled ? 'disabled' : undefined"
				@click.prevent="!disabled && crumb.onClick ? crumb.onClick() : undefined"
			>{{crumb.label}}</a>
			<template v-else>{{crumb.label}}</template>
		</li>
	</ol>
</template>

<script lang="ts">
import Vue from 'vue';

export default Vue.extend({
	props: {
		crumbs: Array as () => Array<{
			label: string,
			title?: string,
			active?: boolean,
			onClick?: () => void
		}>,
		disabled: Boolean,
	},
	computed: {

	}
})
</script>