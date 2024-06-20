<template>
	<SelectPicker v-if="enabled"
		class="username navbar-username navbar-dropdown"
		data-class="btn-link navbar-brand navbar-dropdown-button"
		data-width="auto"
		data-menu-width="auto"
		right
		hideEmpty
		placeholder="Not logged in"
		allowUnknownValues

		:disabled="!canLogin"
		:value="username"
		:options="options"

		@input="handle"
	/>
</template>

<script lang="ts">
import Vue from 'vue';
import SelectPicker, { Option } from '@/components/SelectPicker.vue';

export default Vue.extend({
	components: {SelectPicker},
	props: {
		enabled: {
			type: Boolean,
			default: false,
		},
		canLogin: Boolean,
		username: String as () => string|undefined,
	},
	computed: {
		options(): Option[] {
			const r: Option[] = [];
			if (this.canLogin && !this.username) {
				r.push({label: 'Log in', value: 'login'});
			}
			if (this.canLogin && this.username) {
				r.push({label: 'Log out', value: 'logout'});
			}
			return r;
		}
	},
	methods: {
		handle(value: string) {
			if (value === 'login') {
				this.$emit('login');
			} else if (value === 'logout') {
				this.$emit('logout');
			}
		}
	}
})

</script>

<style lang="scss">

.username [disabled] .menu-caret {
	display: none;
}

.username .menu-value:before {
	content: '\f007'; // fa-user
	font-family: 'FontAwesome';
	display: inline-block;
	width: 1em;
}


</style>