package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.UnknownHostException;
import java.util.Optional;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.tuple.Pair;

import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.response.ArticleResponse.ActionableException;

public class BlackLabApi {
	protected static String blsUrl;
	
	protected final HttpServletRequest clientRequest;
	protected final HttpServletResponse clientResponse;
	
	public BlackLabApi(HttpServletRequest clientRequest, HttpServletResponse clientResponse) {
		this.clientRequest = clientRequest;
		this.clientResponse = clientResponse;
	}
	
	public Optional<Pair<String, QueryException>> getDocumentMetadata(String corpus, String documentId) {

		try {
			Optional<Pair<String, QueryException>> r = AuthRequest.request("GET", AuthRequest.url(blsUrl, corpus, "docs", documentId), clientRequest, clientResponse);
		
//    	final QueryServiceHandler articleMetadataRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus.get()) + "docs/" + URLEncoder.encode(documentId, StandardCharsets.UTF_8.toString()));
//        final Map<String, String[]> requestParameters = new HashMap<>();
//        corpusOwner.ifPresent(s -> requestParameters.put("userid", new String[] { s }));
//        final String metadata = articleMetadataRequest.makeRequest(requestParameters);
//        return Pair.of(metadata, Optional.empty());
    } catch (UnsupportedEncodingException e) { // is subclass of IOException, but is thrown by URLEncoder instead of signifying network error - consider this fatal
        throw new RuntimeException(e);
    } catch (QueryException e) {
        if (e.getHttpStatusCode() == HttpServletResponse.SC_NOT_FOUND) {
            throw new ActionableException(HttpServletResponse.SC_NOT_FOUND, "Unknown document '" + documentId + "'");
        } else {
            return Pair.of("Unexpected blacklab response: " + e.getMessage() + " (code " + e.getHttpStatusCode() + ")", Optional.of(e));
        }
    } catch (UnknownHostException e) {
        return Pair.of("Error while retrieving document metadata, unknown host: " + e.getMessage(), Optional.of(e));
    } catch (IOException e) {
        return Pair.of("Error while retrieving document metadata: " + e.getMessage(), Optional.of(e));
    }
		
		
	}
	
	public static String url(String...strings ) {
		return "";
	}
	public static void setBlsUrl(String url) {
		if (!url.endsWith("/")) {
			url += "/";
		}
		BlackLabApi.blsUrl = url;
	}
}
