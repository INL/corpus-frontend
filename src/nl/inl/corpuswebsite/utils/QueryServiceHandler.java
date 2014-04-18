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
import java.util.Map;

/**
 * Contacts the webservice and returns the response.
 */
public class QueryServiceHandler {

	private String webserviceBaseUrl;

	public QueryServiceHandler(String url) {
		webserviceBaseUrl = url;
	}

	/**
	 * Performs request to the webservice and returns the response.
	 * @param params parameters to send
	 * @return the response
	 * @throws IOException
	 */
	public String makeRequest(Map<String, String[]> params) throws IOException {
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

		return response;
	}

	/**
	 * Construct the GET url from the base URL and the parameter map
	 * @param params the parameters to send
	 * @return the full GET url
	 */
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
			throw new RuntimeException(e);
		}

		return webserviceBaseUrl + "?" + builder.toString();

	}

	public String getBaseUrl() {
		return this.webserviceBaseUrl;
	}
}
