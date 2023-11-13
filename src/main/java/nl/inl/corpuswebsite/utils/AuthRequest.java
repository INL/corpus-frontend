package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.GlobalConfig.Keys;

class URLBuilder<T extends URLBuilder<T>> {
    protected String url;
    protected Map<String, String> headers;
    protected Map<String, String[]> query;
    protected String hash;
    protected String method;

    public URLBuilder(String url) {
        this.url = url;
    }

    public T method(String method) {
        this.method = method;
        return (T) this;
    }

    /** Base url is used as-is (though query and hash are removed), pathParts are escaped and joined using '/' */
    public URLBuilder(String base, String... paths) {
        if (base.contains("#")) {
            String[] parts = base.split("#");
            base = parts[0];
            hash(parts[1]);
        }

        if (base.contains("?")) {
            String[] parts = base.split("\\?");
            base = parts[0];
            query(parts[1]);
        }

        StringBuilder b = new StringBuilder(base);
        for (String s : paths) {
            // append a slash if the url does not end with one
            if (b.length() > 0 && b.charAt(b.length() - 1) != '/') b.append('/');
            b.append(URLEncoder.encode(s, StandardCharsets.UTF_8));
        }
        this.url = b.toString();
    }


    /**
     * Set a query parameter, overwriting any existing value for the key.
     * @param key unescaped key
     * @param value unescaped value(s)
     * @return this
     */
    public T query(String key, String... value) {
        if (query == null) {
            query = new HashMap<>();
        }
        query.put(key, value);
        return (T) this;
    }

    public T query(String key, Optional<String> value) {
        value.ifPresent(s -> query(key, s));
        return (T) this;
    }

    /**
     * Set the query from a string, overwriting any existing value for the keys.
     * @param q url-escaped query string. May contain multiple values for the same key.
     * @return this
     */
    public T query(String q) {
        Arrays.stream(q.replace("?", "").split("&"))
                .map(s -> s.split("=")) // split key=value
                .map(s -> Arrays.stream(s).map(v -> URLDecoder.decode(v, StandardCharsets.UTF_8)).collect(Collectors.toList())) // decode key and value
                .collect(Collectors.groupingBy(s -> s.get(0), Collectors.mapping(s -> s.get(1), Collectors.toList()))) // group values by key
                .forEach((k, v) -> query(k, v.toArray(new String[0]))); // for each key value(s) pair, set the query
        return (T) this;
    }

    /**
     * @param hash The unescaped url hash
     */
    public T hash(String hash) {
        this.hash = hash;
        return (T) this;
    }

    /**
     * Set a header, overwriting any existing value for the key.
     * @param key the unescaped key
     * @param value the unescaped value
     * @return this
     */
    public T header(String key, String value) {
        if (headers == null) {
            headers = new HashMap<>();
        }
        headers.put(key, value);
        return (T) this;
    }

    /**
     * Set the headers from a map, overwriting any existing value for the keys.
     * @param headers the unescaped headers
     * @return this
     */
    public T headers(Map<String, String> headers) {
        if (this.headers == null) {
            this.headers = new HashMap<>();
        }
        this.headers.putAll(headers);
        return (T) this;
    }

    public String getUrl() {
        return getUrl(url, query, hash);
    }

    public static String getUrl(String url, Map<String, String[]> query, String hash) {
        StringBuilder builder = new StringBuilder();
        if (query != null) {
            for (Entry<String, String[]> e : query.entrySet()) {
                for (String value : e.getValue()) {
                    if (builder.length() > 0)
                        builder.append("&");
                    builder.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8));
                    builder.append("=");
                    builder.append(URLEncoder.encode(value, StandardCharsets.UTF_8));
                }
            }
        }
        return url
                + (builder.length() > 0 ? "?" + builder.toString() : "")
                + (hash != null ? "#" + URLEncoder.encode(hash, StandardCharsets.UTF_8) : "");
    }

    public HttpURLConnection connect() throws QueryException {
        try {
            URL urlObj = new URL(getUrl());
            HttpURLConnection connection = (HttpURLConnection) urlObj.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod(method);

            if (headers != null) {
                for (Entry<String, String> header: headers.entrySet()) {
                    connection.addRequestProperty(header.getKey(), header.getValue());
                }
            }

            connection.connect();
            return connection;
        } catch (IOException e) {
            throw QueryException.wrap(e, "Error connecting to url " + url);
        }
    }
}

/** 
 * Make a request to url, passing the provided query and headers.
 * The request should copy the http basic authentication from the provided request.
 * If the provided request does not contain authentication, the response should be used to obtain http basic authentication credentials from the client.
 */
public class AuthRequest extends URLBuilder<AuthRequest> {
    /** May be null */
    private final HttpServletRequest request;
    /** May be null. */
    private final HttpServletResponse response;

    private String method = "GET";

    private final GlobalConfig config;

    /** Standard request without authentication support. We don't need the config if we're not going to communicate to the client. */
    public AuthRequest(String url) {
        super(url);
        this.request = null;
        this.response = null;
        this.config = null;
    }

    public AuthRequest(HttpServletRequest request, HttpServletResponse response, GlobalConfig config) {
        super(null);
        this.request = request;
        this.response = response;
        this.config = config;
    }

    public AuthRequest(HttpServletRequest request, HttpServletResponse response, String url, GlobalConfig config) {
        super(url);
        this.request = request;
        this.response = response;
        this.config = config;
    }

    public AuthRequest method(String method) {
        this.method = method;
        return this;
    }

    /**
     * NOTE:
     * how do we solve the issue with a missing bearer header for initial page load.
     *
     * Is the authorization header added automatically?
     * I don't think it is...?
     * https://stackoverflow.com/a/71998016
     * https://stackoverflow.com/questions/43453206/how-to-include-access-token-in-the-http-header-when-requesting-a-new-page-from-b
     *
     *
     *
     * hit page
     * get back redirect to keycloak (which will redirect back to the current page)
     * hit page again
     * now the code should be present
     * BUT the code cannot be in a header at this time (as we can't set headers before initial load)
     *      it must be in a cookie? (but would the cookie even be passed ? with the samesite and secure flags?)
     *
     *  ============
     *
     *  Current login flow:
     *
     *  1. hit (unsecured) page, javascript loads
     *  2. js redirects to keycloak, with redirect_uri set to the current page
     *      Also response_type = code (a nonce that can be exchanged for access token later)
     *      also response_mode = fragment (so the code is returned in the redirect url hash when the user is redirected back to the current page)
     *  3. (unsecured) page is loaded AGAIN, this time with the code in the hash
     *  4. js extracts the code from the hash, and exchanges it for an access token (form data code, grant_type=authorization_code, client_id, redirect_uri [unused?])
     *     NOTE that cookies are completely unused. (and the access token is not stored in a cookie either)
     *  5. js receives access token.
     *
     *  ============
     *




    // we only are interested in any web errors here.
    // which means a 500 on network errors
    // and otherwise just propagate the http error code.
    // if the request succeeds, we return the content and a null error.
    /**
     * Return the response from the url.
     * If the response is in the 200 range, the content is returned.
     * If the response is in the 300 range, the request is followed.
     * If the response is 401, the request is retried with the authentication header from the request (if present).
     * In all other cases the error is returned (including 404).
     *
     * A 401 might still be returned if the content is restricted for another reason rather than missing auth (or when invalid authentication is supplied).
     *
     * @throws ReturnToClientException when authentication is required but not provided. The response is modified to add the www-authorization header prior to throwing.
     */
    public Result<String, QueryException> request(boolean hardFailOnMissingAuth) {

        // check if we received the OIDC/Oauth2 authorization code (one time pass), exchange it for an access token
        // if we have an access token, add it to the request and retry.
        // NOTE: this won't work either, the client now won't be logged in, the javascript hasn't received the one-time code, since we used it
        // so it can't complete the login when the page actually loads.

        // we just really need to refactor so the page becomes a two-step load, where the secured payload is only retrieved after
        // the login logic has been performed. (and the login logic is performed in the javascript, not in the servlet)


        String exchangeCode = request.getParameter("code");
        if (exchangeCode != null) {
            new URLBuilder<>(config.get(Keys.KEYCLOAK_URL), config.get(Keys.KEYCLOAK_REALM), "protocol/openid-connect/token")
                    .method("POST")
                    .headers(Map.of(
                            "Content-Type", "application/x-www-form-urlencoded",
                            "Accept", "application/json"
                    ))
                    .query("grant_type", "authorization_code")
                    .query("client_id", config.get(Keys.KEYCLOAK_CLIENT_ID))
                    .query("client_secret", config.get(Keys.KEYCLOAK_CLIENT_SECRET))
                    .query("redirect_uri", request.getRequestURL().toString())
                    .query("code", exchangeCode)
                    .request(true)
                    .flatMapWithErrorHandling(json -> {
                        String accessToken = JsonUtils.get(json, "access_token");
                        if (accessToken == null) {
                            return Result.error(new QueryException(-1, "No access token received from keycloak"));
                        }
                        return new AuthRequest(request, response)
                                .url(url)
                                .headers(Map.of("Authorization", "Bearer " + accessToken))
                                .request(hardFailOnMissingAuth);
                    })
                    .ifError(e -> {
        }


        // first try without authenticating.
        try {
            HttpURLConnection r = connect();
            int redirects = 0;
            while (redirects < 10) {
                int code = r.getResponseCode();
                if (code == -1)
                    return Result.error(new QueryException(-1, "Unexpected response from url " + url));

                // redirect is not followed into other protocol ex. http to https
                // see https://stackoverflow.com/a/1884427
                if (code >= 300 && code < 400) {
                    String newUrl = r.getHeaderField("location");
                    if (newUrl != null && !newUrl.isEmpty()) {
                        r = new URLBuilder<>(url)
                                .method(method)
                                .headers(headers)
                                .connect();
                        ++redirects;
                        continue;
                    }
                }


                // at this point, we may receive
                // a) 200 - the resources
                // b) 403 - forbidden (authenticated, but not allowed)
                // c) 401 - unauthorized (authenticate, then try again)

                if (needsUMAAuth(r)) {
                    // we need to craft the login process or something?
                    // maybe just redirect to the login page?
                    // craft the redirect response to the keycloak login page.

                    // create url as follows:

                    // extract the ticket.
                    /* the returned authenticate header looks about like this:
                        WWW-Authenticate: UMA realm="${realm}",
                        as_uri="https://${host}:${port}/realms/${realm}",
                        ticket="016f84e8-f9b9-11e0-bd6f-0021cc6004de"
                    */

                    // there might be two cases though, one is that
                    // we're already logged in, in which case we need to resolve the ticket into a rpt
                    // and the other is that we're not logged in, in which case we need to redirect to the login page.
                    // for now just implement the redirect, we'll figure out the other flows later.


                    String authServerLocation = r.getHeaderField("WWW-Authenticate").split(",")[1].split("=")[1].replace("\"", "");
                    String redirectUrl = new URLBuilder<>(authServerLocation, "auth")
                            .query("client_id", config.get(Keys.KEYCLOAK_CLIENT_ID))
                            .query("redirect_uri", request.getRequestURL().toString())
                            .query("scope", "openid")
                            .query("prompt", "consent") // might need a nonce etc, but eh?
                            .getUrl();

                    response.setHeader("Location", redirectUrl);
                    response.setStatus(HttpServletResponse.SC_MOVED_TEMPORARILY);

                    // need to add the realm, clientid and stuff, but we don't have the config here.


                    // from the server get the well-known
                    // from that get the authorization_endpoint
                    // use that url in conjuction with the realm, clientid, and redirect_uri (current url)
                    // send that as a redirect to the client.
                    // the client will then authenticate, and send the user back to the redirect_uri with a code.
                    // at that point, we will re-receieve the request, this time with a bearer, and we can retry, and resolve this into a 403 or 200.


                    // realm + /auth

                    throw new ReturnToClientException(HttpServletResponse.SC_UNAUTHORIZED, "UMA authentication required", getUMATicket(r);
                }

                // in the case of forbidden, we're done.
                // in the case of 401
                // check whether it's basic auth we require, if so, return to client
                // if it's uma we require, we need to redirect the client, and include the permission ticket from the response.

                // request seems to not require any more authentication, so decode result (might still be an error through, but at least not an auth error)
                if (!needsBasicAuth(r)) return decode(r);
                
                String auth = getExistingAuth(request);
                if (auth != null) {
                    // cool, the request had an authentication header, copy it and try again.
                    if (headers == null)
                        headers = new HashMap<>();
                    headers.put("Authorization", auth);
                    r = request(method, url, query, hash, headers);
                } else if (hardFailOnMissingAuth) {
                    // unhappy path, we don't have auth, and we need it.
                    // this should cause the client to try again with the auth header
                    // so next time the getExistingAuth will return successfully.
                    if (response != null) {
                        response.addHeader("WWW-Authenticate", "Basic realm=\"Blacklab\"");
                        throw new ReturnToClientException(HttpServletResponse.SC_UNAUTHORIZED);
                    }
                    return Result.error(new QueryException(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required"));
                }

                return decode(r);
            }
            return Result.error(new QueryException(HttpServletResponse.SC_BAD_GATEWAY, "Too many redirects"));
        } catch (IOException | QueryException e) {
            return Result.error(QueryException.wrap(e));
        }
    }

    protected static Result<String, QueryException> decode(HttpURLConnection conn) {
        try {
            int code = conn.getResponseCode();
            if (conn.getErrorStream() != null) {
                String body = StringUtils.join(IOUtils.readLines(conn.getErrorStream(), "utf-8"), "\n");
                return Result.error(new QueryException(code, body));
            } else if (code < 200 || code >= 300) {
                return Result.error(new QueryException(code, "Unexpected response (http " + code + ") from url " + conn.getURL()));
            } else if (code == 204) {
                return Result.success("");
            } else {
                String body = StringUtils.join(IOUtils.readLines(conn.getInputStream(), "utf-8"), "\n");
                return Result.success(body);
            }
        } catch (IOException e) {
            return Result.error(QueryException.wrap(e));
        }
    }

    protected static String getExistingAuth(HttpServletRequest request) {
         String auth = request != null ? request.getHeader("Authorization") : null;
         if (auth != null && auth.startsWith("Basic")) return auth;
         return null;
    }

    protected static boolean needsBasicAuth(HttpURLConnection connection) {
        // Usually something like "WWW-Authenticate: Basic realm="Password Required""
        String auth = connection.getHeaderField("WWW-Authenticate");
        return auth != null && auth.startsWith("Basic");
    }

    protected static boolean needsUMAAuth(HttpURLConnection connection) {
        String auth = connection.getHeaderField("WWW-Authenticate");
        return auth != null && auth.startsWith("UMA");
    }

    protected String getUMATicket(HttpURLConnection connection) {
        String auth = connection.getHeaderField("WWW-Authenticate");
        if (auth == null || !auth.startsWith("UMA")) return null;
        return auth.substring("UMA ".length());
    }
}