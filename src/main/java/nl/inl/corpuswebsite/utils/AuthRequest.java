package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.tuple.Pair;

import nl.inl.corpuswebsite.utils.QueryException;

/** 
 * Make a request to url, passing the provided query and headers.
 * The request should copy the http basic authentication from the provided request.
 * If the provided request does not contain authentication, the response should be used to obtain http basic authentication credentials from the client.
 */
public class AuthRequest {
	
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
	public static Pair<String, QueryException> request(String method, String url, HttpServletRequest request, HttpServletResponse response) throws ReturnToClientException { return request(method, url, null, request, response); }
    public static Pair<String, QueryException> request(String method, String url, Map<String, String> headers, HttpServletRequest request, HttpServletResponse response, boolean hardFailOnMissingAuth) throws ReturnToClientException {    
    	// first try without authenticating.
//    	try {
	    	HttpURLConnection r;
	    	int code;
			try {
				r = request(method, url, headers);
				code = r.getResponseCode();
			} catch (IOException e) {
				return Pair.of(null, new QueryException(e));
			}
			if (code == -1) 
				return Pair.of(null, new QueryException(-1, "Unexpected response from url " + url));

	    	// redirect is not followed into other protocol ex. http to https
	        // see https://stackoverflow.com/a/1884427
	        if (code >= 300 && code < 400) {
	        	String newUrl = r.getHeaderField("location");
	        	if (newUrl != null && !newUrl.isEmpty()) {
	        		return request(method, newUrl, headers, request, response, hardFailOnMissingAuth);
	        	}
	        }
	    	
	    	// if it needs auth, try that.
	        // if we don't have auth, just return to client, cause we definitely need it.
	    	if (needsBasicAuth(r)) {
	    		String auth = getExistingAuth(request);
	    		if (auth == null && hardFailOnMissingAuth) {
	    			// this should cause the client to try again with the auth header
	    			// so next time the getExistingAuth will return successfully.
	    	    	response.addHeader("WWW-Authenticate", "Basic realm=\"Blacklab\"");
	    			throw new ReturnToClientException(HttpServletResponse.SC_UNAUTHORIZED);
	    		} else {
	    			return Pair.of(null, new QueryException(code, ""))
	    		}
	    		if (headers == null) 
	    			headers = new HashMap<>();
	    		// cool, the request had an authentication header, copy it and try again.
	    		// we assume it will succeed this time.
	    		// (if this also returns a redirect header, this code will fail... as we'll forward it to the client instead of resolving it internally)
	    		// This usually doesn't happen in the real world though.
	    		headers.put("Authorization", auth);
	    		r = request(method, url, headers);
	    	}
	    	return decode(r);
//		}  
//    	catch (IOException e) {
//			return Pair.of(null, new QueryException(500, e.getMessage()));
//		}
    }
    

	protected static Pair<String, QueryException> decode(HttpURLConnection conn) throws IOException {
		int code = conn.getResponseCode();
		InputStream content = code == 200 ? conn.getInputStream() : conn.getErrorStream();
		String body = StringUtils.join(IOUtils.readLines(content, "utf-8"), "\n");
		QueryException e = (code < 200 || code > 299) ? new QueryException(code, body) : null;
		return Pair.of(e != null ? null : body, e);
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

    
    protected static HttpURLConnection request(String method, String url, Map<String, String> headers) throws IOException {
    	URL urlObj = new URL(url);
    	HttpURLConnection connection = (HttpURLConnection) urlObj.openConnection();
    	connection.setInstanceFollowRedirects(true);
    	connection.setRequestMethod(method);
    	
    	if (headers != null) {
	    	for (Entry<String, String> header : headers.entrySet()) {
	    		connection.addRequestProperty(header.getKey(), header.getValue());
	    	}
    	}	    	
    	
    	connection.connect();
    	return connection;
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
        
        return base + (baseHasQueryAlready ? "?" : "&") + queryParams + ((hash != null && !hash.isEmpty()) ? "#" + URLEncoder.encode(hash, "UTF-8") : "");
    }
}