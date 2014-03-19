/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UnsupportedEncodingException;
import java.net.URL;
import java.net.URLEncoder;
import java.util.LinkedHashMap;
import java.util.Map;


/**
 *
 */
public class QueryServiceHandler {

	// TODO: add static access?

	private String webservice;
	private Map<Map<String, String[]>, String> requestsCache;
	public final int maxCacheSize;

	public QueryServiceHandler(String url, int cacheSize) {
		maxCacheSize = cacheSize;
		webservice = url;

		// create a new linkedhashmap with an initial size of the maximum size it's allowed to be
		// a loadfactor of 0.75 and access-order (most recently accessed first) as ordering mode
		// also a remove eldest entry method to remove the last-accessed entry when we
		// reach our size limit
		requestsCache = new LinkedHashMap<Map<String, String[]>, String>(maxCacheSize, 0.75f, true ){
			@Override
			protected boolean removeEldestEntry(java.util.Map.Entry<Map<String, String[]>, String> eldest) {
				return size() > maxCacheSize;
			}
		};
	}

	public String makeRequest(Map<String, String[]> params) throws IOException {
		// if the same request has already been cached, return that
		if(requestsCache.containsKey(params))
			return getResponseFromCache(params);

		String requestUrl = makeQueryString(params);

		System.out.println("Request: " + requestUrl);

		// if not, send a request to the webserver
		URL webserviceRequest = new URL(requestUrl);
		BufferedReader reader = new BufferedReader(new InputStreamReader(webserviceRequest.openStream()));

		// make url parameter string
		StringBuilder builder = new StringBuilder();
		String line;

		// read the response from the webservice
		while( (line = reader.readLine()) != null )
			builder.append(line);

		reader.close();

		String response = builder.toString();

		// also, cache this request
		cacheRequest(params, response);

		return response;
	}

	private String makeQueryString(Map<String, String[]> params) {
		// make url parameter string
		StringBuilder builder = new StringBuilder();

		try {
			for(String key : params.keySet()) {
				if(params.get(key).length > 0) {
					String[] values = params.get(key);
					for(int i = 0; i < values.length; i++) {
						String value = values[i];
						if(value.length() > 0) {
							builder.append(key);
							builder.append("=");
							builder.append(URLEncoder.encode(value, "UTF-8"));
							builder.append("&");
						}
					}
				}
			}
		} catch (UnsupportedEncodingException e) {
			// TODO Auto-generated catch block
			throw new RuntimeException(e);
		}

		return webservice + "?" + builder.toString();

	}

	private void cacheRequest(Map<String, String[]> params, String response) {
		requestsCache.put(params, response);
	}

	/**
	 * Get the response string from the cache, may return null
	 *
	 * @param params
	 * @return String
	 */
	private String getResponseFromCache(Map<String, String[]> params) {
		return requestsCache.get(params);
	}

	/**
	 * Remove a request from the cache
	 *
	 * @param params
	 */
	public void removeRequestFromCache(Map<String, String[]> params) {
		requestsCache.remove(params);
	}

	public String getUrl() {
		return this.webservice;
	}
}
