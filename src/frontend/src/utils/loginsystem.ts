import {UserManager, Log} from 'oidc-client-ts'

Log.setLogger(console);

const hasSettings = !!(KEYCLOAK_CLIENT_ID && KEYCLOAK_REALM && KEYCLOAK_URL);
const userManager = hasSettings ? new UserManager({
	// TODO remove realm from settings, put in url directly.
	authority: KEYCLOAK_URL + '/realms/' + KEYCLOAK_REALM,
	client_id: KEYCLOAK_CLIENT_ID,
	checkSessionIntervalInSeconds: 10,
	prompt: 'login',
	redirect_uri: window.location.origin + CONTEXT_URL + '/callback',
	// prevent hitting timeouts while debugging?
	silentRequestTimeoutInSeconds: 10000,


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
	try {
		const user = userManager ? await userManager.signinSilent() : null;
		if (user) userManager?.startSilentRenew();
		return user;
	} catch (e) {
		if (e.error !== 'login_required')
			console.warn('Could not restore user session, continuing as anonymous: ', e)
		else console.log('User not logged in, continuing as anonymous');
		return null;
	}
};

export const login = () => userManager?.signinRedirect();
export const logout = () => userManager?.signoutRedirect();

// ONLY to be called when we're the callback page (i.e. the page that the login system redirects to after login - running in an iframe)
// (see callback.ts and callback.vm)
// It will post a message to the parent frame (the main page) with the current url (of this iframe)
// The url will contain tokens (or an error) in the query, which the parent frame (the actual corpus-frontend page) can use to retrieve the user (or show an error).
export const callback = () => { userManager?.signinCallback(); }

