/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Map;

import nl.inl.corpuswebsite.MainServlet;
import nl.inl.util.IoUtil;

/**
 * Contacts the webservice and returns the response.
 */
public class QueryServiceHandler {

	private String webserviceBaseUrl;

	/**
	 * Last backend url requested, so we can pass it to the frontend for status
	 * checks
	 */
	private String lastRequestUrl;

	/**
	 * The servlet, for converting internal URL to external URL for use by
	 * client
	 */
	private MainServlet servlet;

	public QueryServiceHandler(String url, MainServlet servlet) {
		webserviceBaseUrl = url;
		this.servlet = servlet;
	}

	/**
	 * Performs request to the webservice and returns the response.
	 * 
	 * @param params
	 *            parameters to send
	 * @return the response
	 * @throws IOException
	 */
	public String makeRequest(Map<String, String[]> params) throws IOException {
		String requestUrl = makeQueryString(params);
		lastRequestUrl = requestUrl;

		System.out.println("Request: " + requestUrl);
		return fetchXml(requestUrl);
	}

	private String fetchXml(String url) throws IOException {
		int code = -1;
		String reason = null;
		try {
			URL urlObj = new URL(url);
			HttpURLConnection connection = (HttpURLConnection) urlObj
					.openConnection();
			try {
				connection.setRequestProperty("Accept", "application/xml");
				connection.setRequestMethod("GET");
				code = connection.getResponseCode();
				if (code < 200 || code > 299) { // Not an HTTP success (2xx) code?
					reason = connection.getResponseMessage();
					throw new IOException(code + " " + reason);
				}
				InputStream response = connection.getInputStream();
				return IoUtil.readTextStream(response);
			} finally {
				connection.disconnect();
			}
		} catch (MalformedURLException e) {
			throw new IOException("Malformed URL", e);
		} catch (Exception e) {
			throw new IOException("Error fetching response", e);
		}
	}

	/**
	 * Construct the GET url from the base URL and the parameter map
	 * 
	 * @param params
	 *            the parameters to send
	 * @return the full GET url
	 */
	private String makeQueryString(Map<String, String[]> params) {
		// make url parameter string
		StringBuilder builder = new StringBuilder();

		if (params != null) {
			try {
				for (String key: params.keySet()) {
					if (params.get(key).length > 0) {
						String[] values = params.get(key);
						for (int i = 0; i < values.length; i++) {
							String value = values[i];
							if (value.length() > 0) {
								if (builder.length() > 0)
									builder.append("&");
								builder.append(key);
								builder.append("=");
								builder.append(URLEncoder
										.encode(value, "UTF-8"));
							}
						}
					}
				}
			} catch (UnsupportedEncodingException e) {
				throw new RuntimeException(e);
			}
		}

		return webserviceBaseUrl + "?" + builder.toString();

	}

	public String getBaseUrl() {
		return webserviceBaseUrl;
	}

	public String getLastRequestUrlForClient(String corpus) {
		return lastRequestUrl.replace(servlet.getWebserviceUrl(corpus),
				servlet.getExternalWebserviceUrl(corpus));
	}
}
