package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.parsers.ParserConfigurationException;

import net.sf.saxon.ma.trie.ImmutableMap;
import org.apache.commons.lang3.tuple.Pair;
import org.xml.sax.SAXException;

public class BlackLabApi {
	protected static String blsUrl;
	
	protected final HttpServletRequest clientRequest;
	protected final HttpServletResponse clientResponse;
	
	public BlackLabApi(HttpServletRequest clientRequest, HttpServletResponse clientResponse) {
		this.clientRequest = clientRequest;
		this.clientResponse = clientResponse;
	}
	
	public AuthRequest.Result<String, QueryException> getDocumentMetadata(String corpus, String documentId) {
		return AuthRequest.request("GET", AuthRequest.url(blsUrl, corpus, "docs", documentId), clientRequest, clientResponse, true);
	}

	public AuthRequest.Result<CorpusConfig, Exception> getCorpusConfig(String corpus) {
		final String url = AuthRequest.url(blsUrl, corpus);
		final HashMap<String, String> query = new HashMap<>();
		query.put("outputformat", "xml");

		return AuthRequest.request("GET",url,query,clientRequest,clientResponse,true)
			.flatMapAnyError(xml -> {
				query.put("outputformat", "json");
				query.put("listvalues", CorpusConfig.getAnnotationsWithRequiredValues(xml));// extract annotations that we need all values for
				final AuthRequest.Result<String, QueryException> jsonResponse = AuthRequest.request("GET", url, query, clientRequest, clientResponse, true);
				String json = jsonResponse.getOrThrow();
				return new CorpusConfig(corpus, xml, json);
			});
	}

	public AuthRequest.Result<String, QueryException> getStylesheet(String formatName) {
		return AuthRequest.request("GET", AuthRequest.url(blsUrl, "input-formats", formatName, "xslt"), clientRequest, clientResponse, true);
	}
	
	public static void setBlsUrl(String url) {
		if (!url.endsWith("/")) {
			url += "/";
		}
		BlackLabApi.blsUrl = url;
	}
}
