import LoginButton from '@/components/LoginButton.vue';

function initLoginButton() {
	if (KEYCLOAK_URL && KEYCLOAK_REALM && KEYCLOAK_CLIENT_ID) {
		const button = new LoginButton({
			propsData: {
				url: KEYCLOAK_URL,
				realm: KEYCLOAK_REALM,
				clientId: KEYCLOAK_CLIENT_ID,
			}
		});
		button.$mount('.navbar-username');
	}
}

$(document).ready(initLoginButton);