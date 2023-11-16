import {UserManager, User} from 'oidc-client-ts'

const hasSettings = !!(KEYCLOAK_CLIENT_ID && KEYCLOAK_REALM && KEYCLOAK_URL);
const userManager = hasSettings ? new UserManager({
	authority: KEYCLOAK_URL,
	client_id: KEYCLOAK_CLIENT_ID,
	checkSessionIntervalInSeconds: 10,
	prompt: 'login',
	redirect_uri: window.location.href,
	//monitorSession: true,
	// client_id: KEYCLOAK_CLIENT_ID,
	// authority: KEYCLOAK_URL,
	// redirect_uri: window.location.origin + '/login',
	// response_type: 'code',
	// scope: 'openid profile email',
}) : null;

// This probably won't work (cookies and iframes...)
/**
 * You should await this before doing other things.
 * Initialize the login system, check if user is currently logged in, and start an automatic refresh of access tokens if they are.
 */

export const awaitInit = async () => {
	const user = userManager ? await userManager.signinSilent() : null;
	if (user) userManager?.startSilentRenew();
	return user;
};

export const login = () => userManager?.signinRedirect();
export const logout = () => userManager?.signoutRedirect();
