package org.ivdnt.cf.utils;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

/** 
 * Make a request to url, passing the provided query and headers.
 * The request should copy the http basic authentication from the provided request.
 * If the provided request does not contain authentication, the response should be used to obtain http basic authentication credentials from the client.
 */
public class AuthRequest {

    private HttpServletRequest request;
    private HttpServletResponse response;
    private Map<String, String> headers = null;

    private Map<String, String[]> query = null;

    private String hash = null;

    private String method = "GET";

    private String url;

    public AuthRequest(HttpServletRequest request, HttpServletResponse response) {
        this.request = request;
        this.response = response;
    }

    public AuthRequest(HttpServletRequest request, HttpServletResponse response, String url) {
        this.request = request;
        this.response = response;
        this.url = url;
    }

    /** Base url is used as-is (though query and hash are removed), pathParts are escaped and joined using '/' */
    public AuthRequest url(String base, String... paths) {
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
        return this;
    }

    /**
     * Set a query parameter, overwriting any existing value for the key.
     * @param key unescaped key
     * @param value unescaped value(s)
     * @return this
     */
    public AuthRequest query(String key, String... value) {
        if (query == null) {
            query = new HashMap<>();
        }
        query.put(key, value);
        return this;
    }

    public AuthRequest query(String key, Optional<String> value) {
        value.ifPresent(s -> query(key, s));
        return this;
    }

    /**
     * Set the query from a string, overwriting any existing value for the keys.
     * @param q url-escaped query string. May contain multiple values for the same key.
     * @return this
     */
    public AuthRequest query(String q) {
        Arrays.stream(q.replace("?", "").split("&"))
                .map(s -> s.split("=")) // split key=value
                .map(s -> Arrays.stream(s).map(v -> URLDecoder.decode(v, StandardCharsets.UTF_8)).collect(Collectors.toList())) // decode key and value
                .collect(Collectors.groupingBy(s -> s.get(0), Collectors.mapping(s -> s.get(1), Collectors.toList()))) // group values by key
                .forEach((k, v) -> query(k, v.toArray(new String[0]))); // for each key value(s) pair, set the query
        return this;
    }

    /**
     * @param hash The unescaped url hash
     */
    public AuthRequest hash(String hash) {
        this.hash = hash;
        return this;
    }

    public AuthRequest method(String method) {
        this.method = method;
        return this;
    }

    /**
     * Set a header, overwriting any existing value for the key.
     * @param key the unescaped key
     * @param value the unescaped value
     * @return this
     */
    public AuthRequest header(String key, String value) {
        if (headers == null) {
            headers = new HashMap<>();
        }
        headers.put(key, value);
        return this;
    }

    /**
     * Set the headers from a map, overwriting any existing value for the keys.
     * @param headers the unescaped headers
     * @return this
     */
    public AuthRequest headers(Map<String, String> headers) {
        if (this.headers == null) {
            this.headers = new HashMap<>();
        }
        this.headers.putAll(headers);
        return this;
    }

    private static String url(String url, Map<String, String[]> query, String hash) {
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

    // we only are interested in any web errors here.
    // which means a 500 on network errors
    // and otherwise just propagate the http error code.
    // if the request succeeds, we return the content and a null error.
    /**
     * Return the response from the url.
     * If the response is in the 200 range, the content is returned.
     * If the response is in the 300 range, the request is followed.
     * If the response is 401 range, the request is retried with the authentication header from the request (if present).
     * In all other cases the error is returned.
     *
     * A 401 might still be returned if the content is restricted for another reason rather than missing auth (or when invalid authentication is supplied).
     *
     * @throws ReturnToClientException when authentication is required but not provided. The response is modified to add the www-authorization header prior to throwing.
     */
    public Result<String, QueryException> request(boolean hardFailOnMissingAuth) {
        // first try without authenticating.
        try {
            HttpURLConnection r = request(method, url, query, hash, headers);
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
                        r = request(method, newUrl, null, null, headers);
                        ++redirects;
                        continue;
                    }
                }

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
                    response.addHeader("WWW-Authenticate", "Basic realm=\"Blacklab\"");
                    throw new ReturnToClientException(HttpServletResponse.SC_UNAUTHORIZED);
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
         String auth = request.getHeader("Authorization");
         if (auth != null && auth.startsWith("Basic")) return auth;
         return null;
    }

    protected static boolean needsBasicAuth(HttpURLConnection connection) {
        // Usually something like "WWW-Authenticate: Basic realm="Password Required""
        String auth = connection.getHeaderField("WWW-Authenticate");
        return auth != null && auth.startsWith("Basic");
    }

    protected static HttpURLConnection request(String method, String url, Map<String, String[]> query, String hash, Map<String, String> headers) throws QueryException {
        try {
            URL urlObj = new URL(url(url, query, hash));
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
            throw QueryException.wrap(e);
        }
    }
}