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

// import Keycloak, {KeycloakConfig} from '@/vendor/keycloak';
// import Keycloak, {KeycloakConfig} from 'keycloak-js';


export default Vue.extend({
	props: {
		/** Base url of the keycloak instance. Ex. : http://localhost:8080/auth */
		url: String,
		/** Realm in keycloak */
		realm: String,
		/** Client ID */
		clientId: String
	},
	data: () => ({
		username: null as null|string,
		// keycloak: null as null|Keycloak
	}),
	// computed: {
	// 	keycloakOptions(): KeycloakConfig|null {
	// 		return {
	// 			url: this.url,
	// 			realm: this.realm,
	// 			clientId: this.clientId
	// 		};
	// 	}
	// },
	methods: {
		login() {
			// if (!this.keycloak) return;
			// this.keycloak.login();
		},
		logout() {
			// if (!this.keycloak) return;
			// this.keycloak.logout();
		}
	},
	// watch: {
	// 	keycloakOptions: {
	// 		immediate: true,
	// 		handler(options: KeycloakConfig) {
	// 			if (this.keycloak) this.keycloak.logout();
	// 			if (!options?.clientId || !options?.realm || !options?.url) return;

	// 			const keycloak = this.keycloak = new Keycloak(options);
	// 			keycloak.init({
	// 				// onLoad: 'check-sso',
	// 				enableLogging: true,
	// 				checkLoginIframe: false

	// 				// onLoad: 'check-sso',
	// 			}).then(authenticated => {
	// 				if (authenticated) {
	// 					keycloak.loadUserProfile().then(profile => this.username = profile.username ?? 'unknown');
	// 				} else {
	// 					console.log('not authenticated');
	// 				}
	// 			});
	// 		},
	// 	}
	// },
	// beforeMount() {

	// }
})

</script>