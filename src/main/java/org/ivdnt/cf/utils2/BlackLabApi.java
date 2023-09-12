package org.ivdnt.cf.utils2;

import java.util.Optional;

import org.ivdnt.cf.CFApiException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Helper class for talking to BlackLab.
 * Is initialized with the BlackLab server URL once on startup.
 * Has methods for getting various things from BlackLab, with the ability to copy basic auth headers from the client request (which is why it needs the request and response objects).
 */
public class BlackLabApi {
	protected final String blsUrl;
	
	protected final HttpServletRequest request;
	protected final HttpServletResponse response;

	public BlackLabApi(String blsUrl, HttpServletRequest clientRequest, HttpServletResponse clientResponse) {
		this.blsUrl = blsUrl;
		this.request = clientRequest;
		this.response = clientResponse;
	}
	
	public Result<String, CFApiException> getDocumentMetadata(String corpus, String documentId) {
		return new AuthRequest(request, response)
				.url(blsUrl, corpus, "docs", documentId)
				.query("outputformat", "xml")
				.request(true);
	}

	public Result<CorpusConfig, Exception> getCorpusConfig(String corpus) {
		return new AuthRequest(request, response)
				.url(blsUrl, corpus)
				.query("outputformat", "xml")
				.request(true)
				.flatMapWithErrorHandling(xml ->
						new AuthRequest(request, response)
							.url(blsUrl, corpus)
							.query("outputformat", "json")
							.query("listvalues", CorpusConfig.getAnnotationsWithRequiredValues(xml))
							.request(true)
							.mapWithErrorHandling(json -> new CorpusConfig(corpus, xml, json))
				);
	}

	public Result<String, CFApiException> getStylesheet(String formatName) {
		return new AuthRequest(request, response)
				.url(blsUrl, "input-formats", formatName, "xslt")
				.request(true);
	}

	public Result<String, CFApiException> getDocumentContents(String corpus, String docId, Optional<String> blacklabQuery, Optional<String> pattgap, Optional<Integer> pageStart, Optional<Integer> pageEnd) {
		return new AuthRequest(request, response)
				.url(blsUrl, corpus, "docs", docId, "contents")
				.query("patt", blacklabQuery)
				.query("pattgapdata", pattgap)
				.query("wordstart", pageStart.map(Object::toString))
				.query("wordend", pageEnd.map(Object::toString))
				.request(true);
	}
}
