<template>
	<div class="username navbar-username navbar-brand">
		<!-- bootstrap 3 caret with with logout button in dropdown -->
		<div class="dropdown">
			<a href="#" class="dropdown-toggle" data-toggle="dropdown">
				<span class="fa fa-solid fa-user"></span>
				<span class="username">{{username || 'Anonymous'}}</span>
				<span class="caret"></span>
			</a>
			<ul class="dropdown-menu pull-left" style="z-index: 10000; transform: none; position: absolute;">
				<li><a href="#" @click="username ? logout() : login()">Log {{username ? 'out' : 'in'}}</a></li>
			</ul>
		</div>
	</div>
</template>



<script lang="ts">
import Vue from 'vue';

import * as loginSystem from '@/utils/loginsystem-api';

// import Keycloak, {KeycloakConfig} from '@/vendor/keycloak';
// import Keycloak, {KeycloakConfig} from 'keycloak-js';

export default Vue.extend({
	data: () => ({
		loading: false,
		username: undefined as undefined|string,
		// keycloak: null as null|Keycloak
	}),
	methods: {
		login() {
			this.loading = true;
			loginSystem.login()?.then(() => {
				this.loading = false;
			});
		},
		logout() {
			loginSystem.logout();
		}
	},
	mounted() {
		loginSystem.userManager?.events.addUserLoaded(user => {
			this.username = user.profile.email || user.profile.name;
		});
		loginSystem.userManager?.events.addUserUnloaded(() => {
			this.username = undefined;
		});
	}
})

</script>