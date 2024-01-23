import {UserManager, Log} from 'oidc-client-ts'

// Separate from loginsystem.ts to prevent circular dependency between LoginButton and loginsystem.
//@ts-ignore
if (process.env.NODE_ENV === 'development') Log.setLogger(console);

const hasSettings = typeof KEYCLOAK_CLIENT_ID === 'string' && typeof KEYCLOAK_REALM === 'string' && typeof KEYCLOAK_URL === 'string' && 
	KEYCLOAK_CLIENT_ID.length && KEYCLOAK_REALM.length && KEYCLOAK_URL.length;
export const userManager = hasSettings ? new UserManager({
	// TODO remove realm from settings, put in url directly.
	authority: KEYCLOAK_URL + '/realms/' + KEYCLOAK_REALM,
	client_id: KEYCLOAK_CLIENT_ID,
	checkSessionIntervalInSeconds: 10,
	prompt: 'login',
	redirect_uri: window.location.origin + CONTEXT_URL + '/callback',
	// prevent hitting timeouts while debugging?
	// @ts-ignore
	silentRequestTimeoutInSeconds: process.env.NODE_ENV === 'development' ? 300 : 10,


	//monitorSession: true,
	// client_id: KEYCLOAK_CLIENT_ID,
	// authority: KEYCLOAK_URL,
	// redirect_uri: window.location.origin + '/login',
	// response_type: 'code',
	// scope: 'openid profile email',
}) : null;

/** In-flow login. I.E. redirect the current page to the auth server, and have it (the auth server) redirect back to the current page. After which we will run the userManager.signinCallback() function (see loginsystem.ts::awaitinit) which should pick up the info returned by the auth server. */
export const login = () => userManager?.signinRedirect({redirect_uri: window.location.href});
/** In-flow logout. I.E. redirect the current page to the auth server, and have it (the auth server) redirect back to the current page. After which we will run the userManager.signinCallback() function (see loginsystem.ts::awaitinit) which should pick up that no user is logged in anymore. */
export const logout = () => userManager?.signoutRedirect({post_logout_redirect_uri: window.location.href});

// ONLY to be called when we're the callback page (i.e. the page that the login system redirects to after login - running in an iframe)
// (see callback.ts and callback.vm)
// It will post a message to the parent frame (the main page) with the current url (of this iframe)
// The url will contain tokens (or an error) in the query, which the parent frame (the actual corpus-frontend page) can use to retrieve the user (or show an error).
export const callback = () => { userManager?.signinCallback(); }
