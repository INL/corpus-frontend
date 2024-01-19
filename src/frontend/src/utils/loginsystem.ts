import { User } from 'oidc-client-ts';
import * as LoginSystem from './loginsystem-api';
import LoginButton from '@/components/LoginButton.vue';


// this one re-exports the loginsystem-api.ts, but also adds a LoginButton component.
// and adds the init function

/**
 * This function is meant to run on the main content pages.
 * 
 * You should await this before doing other things.
 * Initialize the login system, check if user is currently logged in, and start an automatic refresh of access tokens if they are.
 */
export const awaitInit = async () => {
	const userManager = LoginSystem.userManager;
	if (!userManager) return null;
	// first up: mount the button, so it will exist when the login event fires.
	new LoginButton().$mount('.username');

	let user: User | null | undefined | void = null;
	// first see if we're currently in a callback
	try { user = await userManager.signinCallback() }
	catch {
		// not a signincallback, but maybe there's a session alive still
		// check in an iframe.
		try { user = await userManager.signinSilent() }
		catch { } // oh well... no user.
	}
	try {
		// clear the hash and query info related to the callback
		const url = new URL(window.location.href);
		url.searchParams.delete('error');
		url.searchParams.delete('state');
		url.searchParams.delete('session_state');
		url.searchParams.delete('code');
		url.searchParams.delete('scope');
		// place back the url without the callback info
		window.history.replaceState({}, '', url);
	} catch (e) { }

	if (user) userManager.startSilentRenew();
	return user || null; // normalize weird void type to null.
};

//re-export everything from loginsystem-api
export * from './loginsystem-api';