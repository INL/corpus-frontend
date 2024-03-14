/**
 * This is the main javascript bundle for the OIDC callback page.
 * OIDC works by first redirecting the user to a login page, and then after login, that page redirecting back to a callback page.
 * The callback page will have an extra parameter in the url, which contains the tokens.
 *
 * If we're restoring a session, this happens in an iframe.
 * The iframe will then send the tokens to the parent frame (the main page).
 * After which the parent frame has the user info, and the iframe can be removed.
 *
 * If we're logging in, the callback page will redirect to the main page, with the tokens in the url.
 */

import * as loginSystem from '@/utils/loginsystem';

loginSystem.awaitInit();