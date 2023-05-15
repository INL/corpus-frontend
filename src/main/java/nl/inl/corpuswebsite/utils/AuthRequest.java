package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.function.Function;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

/** 
 * Make a request to url, passing the provided query and headers.
 * The request should copy the http basic authentication from the provided request.
 * If the provided request does not contain authentication, the response should be used to obtain http basic authentication credentials from the client.
 */
public class AuthRequest {

    public static class Result<R, E extends Exception> {
        public interface ThrowableSupplier<R, E extends Exception> {
            R apply() throws E;
        }

        public interface ThrowableFunction<A, R, E extends Exception> {
            R apply(A a) throws E;
        }

//        public interface ThrowableFunction2<A, R, E extends Exception, E2 extends Exception> {
//            R apply(A a) throws E, E2;
//        }

        private final R result;
        private final E error;

        public Result(R result, E error) {
            this.result = result;
            this.error = error;
        }

        public static <R, E extends Exception> Result<R, E> empty() {
            return new Result<>(null, null);
        }

        @SuppressWarnings("unchecked")
        public static <R, E extends Exception> Result<R, E> attempt(ThrowableSupplier<R, E> gen) {
            try {
                return new Result<>(gen.apply(), null);
            } catch (Exception e) {
                if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                return Result.error((E) e);
            }
        }


        // if E2 == E, result<R2, E2>
        // if E2 != E, result<R2, Exception>
        // if no E2, result<R2, E>

        // first implementation: overload for E2 == E
        @SuppressWarnings("unchecked")
        public <R2, E2 extends E> Result<R2, E> flatMap(ThrowableFunction<R, R2, E2> gen) {
            if (this.result != null) {
                try {
                    R2 r2 = gen.apply(this.result);
                    return new Result<>(r2, null);
                } catch (Exception e) {
                    if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                    return Result.error((E)e);
                }
            } else {
                return Result.error(this.error);
            }
        }

        // second implementation, overload for E2 != E
        public <R2, E2 extends Exception> Result<R2, Exception> flatMapAnyError(ThrowableFunction<R, R2, E2> gen) {
            if (this.result != null) {
                try {
                    R2 r2 = gen.apply(this.result);
                    return new Result<>(r2, null);
                } catch (Exception e) {
                    if (e instanceof ReturnToClientException) throw (ReturnToClientException) e;
                    return Result.error(e);
                }
            } else {
                return Result.error(this.error);
            }
        }

        // third implementation, no E2
        public <R2> Result<R2, E> flatMap(Function<R, R2> gen) {
            if (this.result != null) {
                return new Result<>(gen.apply(this.result), null);
            } else {
                return Result.error(this.error);
            }
        }

        public static <R, E extends Exception> Result<R, E> success(R result) {
            return new Result<>(result, null);
        }

        public static <R, E extends Exception> Result<R, E> error(E error) {
            return new Result<>(null, error);
        }

        public <R2> Result<R2, E> map(Function<R, R2> handleSuccess) {
            if (this.error != null) return new Result<>(null, this.error);
            return new Result<>(handleSuccess.apply(result), null);
        }

        public <E2 extends Exception> Result<R, E2> mapError(Function<E, E2> handleError) {
            if (this.error != null) return new Result<>(null, handleError.apply(this.error));
            return new Result<>(result, null);
        }

        public <SpecificException extends E, E2 extends Exception> Result<R, E2> mapError(Class<SpecificException> clazz, Function<SpecificException, E2> handleError) {
            if (this.error != null && clazz.isAssignableFrom(this.error.getClass())) return new Result<>(null, handleError.apply(clazz.cast(this.error)));
            return new Result<>(result, null);
        }

        public Optional<E> getError() {
            return Optional.ofNullable(error);
        }

        public Optional<R> getResult() {
            return Optional.ofNullable(result);
        }

        public R getOrThrow() throws E {
            if (this.error != null) throw this.error;
            if (this.result == null) throw new IllegalStateException("Result is null");
            return this.result;
        }

//        public <R2> Result<R2, E> flatMap(Function<R, Result<R2, E>> handleSuccess) {
//            if (this.error != null) return new Result<>(null, this.error);
//            return handleSuccess.apply(result);
//        }

        public <E2 extends Exception> Result<R, E2> flatMapError(Function<E, Result<R, E2>> handleError) {
            if (this.error != null) return handleError.apply(this.error);
            return new Result<>(result, null);
        }
    }



    /**
     * return result.handleError(error -> {
     *   return ...;
     * })
     * .handleSuccess(success -> {
     * 	return ...;
     * });
     */

    // we only are interested in any web errors here.
    // which means a 500 on network errors
    // and otherwise just propagate the http error code.
    // if the request succeeds, we return the content and a null error.
    /**
     * Return the response from the url.
     * An empty optional might be returned if authentication is required for the url, and is not present on through the passed request.
     *
     * In all other cases, the content (if response was in the OK range (200-299)) or error are returned.
     * So a 404 will return Pair.of(null, new QueryException(404))
     *
     * A 401 might still be returned if the content is restricted for another reason rather than missing auth.
     *
     * @throws ReturnToClientException when authentication is required but not provided. The response is modified to add the www-authorization header prior to throwing.
     */
    public static Result<String, QueryException> request(String method, String url, HttpServletRequest request, HttpServletResponse response, boolean hardFailOnMissingAuth) { return request(method, url, null, request, response, hardFailOnMissingAuth); }
    public static Result<String, QueryException> request(String method, String url, Map<String, String> headers, HttpServletRequest request, HttpServletResponse response, boolean hardFailOnMissingAuth) {
        // first try without authenticating.
        try {
            HttpURLConnection r = request(method, url, headers);
            int code = r.getResponseCode();
            if (code == -1)
                return Result.error(new QueryException(-1, "Unexpected response from url " + url));

            // redirect is not followed into other protocol ex. http to https
            // see https://stackoverflow.com/a/1884427
            if (code >= 300 && code < 400) {
                String newUrl = r.getHeaderField("location");
                if (newUrl != null && !newUrl.isEmpty()) {
                    return request(method, newUrl, headers, request, response, hardFailOnMissingAuth);
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
                r = request(method, url, headers);
            } else if (hardFailOnMissingAuth) {
                // unhappy path, we don't have auth, and we need it.
                // this should cause the client to try again with the auth header
                // so next time the getExistingAuth will return successfully.
                response.addHeader("WWW-Authenticate", "Basic realm=\"Blacklab\"");
                throw new ReturnToClientException(HttpServletResponse.SC_UNAUTHORIZED);
            }

            return decode(r);
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

    protected static HttpURLConnection request(String method, String url, Map<String, String> headers) throws QueryException {
        try {
            URL urlObj = new URL(url);
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

    /** Base url is used as-is, pathParts are escaped and joined using '/' */
    public static String url(String base, String... pathParts) {
        try {
            StringBuilder b = new StringBuilder(base);
            for (String s : pathParts) {
                b.append(URLEncoder.encode(s, "UTF-8"));
            }
            return b.toString();
        } catch (UnsupportedEncodingException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * @param base the url + any path + (optionally) some ENCODED query parameters (these are preserved)
     * @param queryParams UNENCODED query parameters (optional)
     * @param hash any hash (optional)
     * @throws UnsupportedEncodingException
     * */
    public static String url(String base, Map<String, String[]> queryParams, String hash) throws UnsupportedEncodingException {
        boolean baseHasQueryAlready = base.contains("?");

        StringBuilder builder = new StringBuilder();
        if (queryParams != null) {
            for (Entry<String, String[]> e : queryParams.entrySet()) {
                for (String value : e.getValue()) {
                    if (builder.length() > 0)
                        builder.append("&");
                    builder.append(e.getKey());
                    builder.append("=");
                    builder.append(URLEncoder.encode(value, "UTF-8"));
                }
            }
        }

        return base + (baseHasQueryAlready ? "?" : "&") + builder + ((hash != null && !hash.isEmpty()) ? "#" + URLEncoder.encode(hash, "UTF-8") : "");
    }
}