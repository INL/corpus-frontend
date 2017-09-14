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

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

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
	 *
	 * @param params
	 *            parameters to send
	 * @return the response
	 * @throws IOException
	 */
	public String makeRequest(Map<String, String[]> params) throws IOException {
		String requestUrl = makeQueryString(params);

		System.out.println("Request: " + requestUrl);
		return fetchXml(requestUrl);
	}

	private static String fetchXml(String url) throws IOException {
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

				// Not an HTTP success (2xx) code or 401 Unauthorized?
				// (we use the 401 to test if we are allowed to view the document contents)
				if ( (code < 200 || code > 299) && code != 401) {
					reason = connection.getResponseMessage();
					throw new IOException(code + " " + reason);
				}
				try (InputStream response = code == 401 ? connection.getErrorStream() : connection.getInputStream()) {
				    return StringUtils.join(IOUtils.readLines(response, "utf-8"), "\n");
				}
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
}
