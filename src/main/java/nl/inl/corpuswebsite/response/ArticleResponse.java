package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.tuple.Pair;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.QueryServiceHandler.QueryException;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.corpuswebsite.utils.XslTransformer;

public class ArticleResponse extends BaseResponse {

    /** Default transformer that translates <hl> tags into highlighted spans and outputs all text */
    private static final XslTransformer defaultTransformer;

    /** Matches xml open/void tags &lt;namespace:tagname attribute="value"/&gt; excluding hl tags, as those are inserted by blacklab and can result in false positives */
    private static final Pattern XML_TAG_PATTERN = Pattern.compile("<([\\w]+:)?((?!(hl|blacklabResponse|[xX][mM][lL])\\b)[\\w.]+)(\\s+[\\w\\.]+=\"[\\w\\s,]*\")*\\/?>");

    private static final Pattern CAPTURE_DOCLENGTH_PATTERN = Pattern.compile("<lengthInTokens>\\s*(\\d+)\\s*<\\/lengthInTokens>");


    static {
        try {
            // @formatter:off
            defaultTransformer = new XslTransformer("DEFAULTTRANSFORMER",new StringReader(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<xsl:stylesheet version=\"2.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">" +
                    "<xsl:output encoding=\"utf-8\" method=\"html\" omit-xml-declaration=\"yes\" />" +
                    "<xsl:template match=\"*[local-name(.)='hl']\">" +
                        "<span class=\"hl\">" +
                        "<xsl:apply-templates select=\"node()\"/>" +
                        "</span>" +
                    "</xsl:template>" +
                "</xsl:stylesheet>"));
            // @formatter:on
        } catch (TransformerException e) {
            throw new RuntimeException(e);
        }
    }

    public ArticleResponse() {
        super(true);
    }

    @SuppressWarnings("unused")
    private static class ActionableException extends Exception {
		public final int httpCode;
        private final Optional<String> message;

        public ActionableException(int httpCode, String message) {
            super();
            this.httpCode = httpCode;
            this.message = Optional.ofNullable(message);
        }
        public ActionableException(int httpCode) {
        	this(httpCode, null);
        }
    }

    private String getDocPid() throws ActionableException {
        if (pathParameters.size() != 1) {
            throw new ActionableException(
                    HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid document id format " + StringUtils.join(pathParameters, '/') + " - should just be a single string, with any contained slashes encoded."
            );
        }

        String pid = pathParameters.get(0);
        if (pid == null || pid.isEmpty()) {
            throw new ActionableException(HttpServletResponse.SC_NOT_FOUND);
        }
        return pid;
    }

    private CorpusConfig getCorpusConfig() throws ActionableException {
        Pair<CorpusConfig, Exception> blackLabInfo = servlet.getCorpusConfig(corpus);
        // surface errors about this config - if there are any
        if (blackLabInfo.getRight() instanceof QueryException) { 
        	QueryException e = (QueryException) blackLabInfo.getRight();
        	throw new ActionableException(
        			e.getHttpStatusCode() == HttpServletResponse.SC_NOT_FOUND ? HttpServletResponse.SC_NOT_FOUND : HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
					e.getHttpStatusCode() == HttpServletResponse.SC_NOT_FOUND ? null : e.getMessage()
        	);
        } else if (blackLabInfo.getRight() != null) {
        	Exception e = blackLabInfo.getRight();
        	throw new ActionableException(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error retrieving corpus information: " + (e.getMessage() != null ? ": " + e.getMessage() : ""));
        }
        return blackLabInfo.getLeft();
    }

    // TODO: return errors array.
    // TODO: add parameters to metadata stylesheet
    /**
     * Fetch the document's metadata from blacklab, load the metadata stylesheet, and return the transformed result.
     * In case of errors, a string describing the error will be returned instead of the metadata.
     * @param documentId
     * @param corpusOwner
     * @param corpusDataFormat may be null
     * @return
     */
    protected String getMetadata(String documentId, Optional<String> corpusOwner, String corpusDataFormat) {
        try {
            final QueryServiceHandler articleMetadataRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus) + "docs/" + URLEncoder.encode(documentId, StandardCharsets.UTF_8.toString()));
            final Map<String, String[]> requestParameters = new HashMap<>();
            corpusOwner.ifPresent(s -> requestParameters.put("userid", new String[] { s }));
            final String meta = articleMetadataRequest.makeRequest(requestParameters);
            final Optional<XslTransformer> metadataStylesheet = addParametersToStylesheet(servlet.getStylesheet(corpus, "meta", corpusDataFormat));
            return metadataStylesheet.isPresent() ? metadataStylesheet.get().transform(meta) : "Cannot display metadata - misconfigured server, missing metadata stylesheet (meta.xsl) - see README.MD, section #frontend-configuration"; 
        } catch (UnsupportedEncodingException e) { // is subclass of IOException, but is thrown by URLEncoder instead of signifying network error - consider this fatal
            throw new RuntimeException(e);
        } catch (QueryException e) {
            return "Unexpected blacklab response: " + e.getMessage() + " (code " + e.getHttpStatusCode() + ")";
        } catch (IOException e) {
            return "Error while retrieving document metadata: " + e.getMessage();
        } catch (TransformerException e) {
            return "<h1>Error in metadata stylesheet</h1>\n" + e.getMessageAndLocation();
        }
    }
    
    protected Optional<XslTransformer> addParametersToStylesheet(Optional<XslTransformer> transformer) {
//    	transformer.ifPresent(t -> {
//	    	t.addParameter("", servlet.getServletContext().getContextPath());
//	    	servlet.getWebsiteConfig(corpus).getXsltParameters().forEach(t::addParameter);    	
//    	});
    	return transformer;
    }

    // TODO: return errors array
    protected String getContent(String documentId, Optional<String> corpusOwner, String corpusDataFormat, boolean usePagination) {
        // Compute pagination info, if required.
        final HashMap<String, String[]> requestParameters = new HashMap<>();
        corpusOwner.ifPresent(v -> requestParameters.put("userid", new String[] { v }));
        Optional.ofNullable(this.getParameter("query", (String) null)).ifPresent(v -> requestParameters.put("patt", new String[] { v }));
        Optional.ofNullable(this.getParameter("pattgapdata", (String) null)).ifPresent(v -> requestParameters.put("pattgapdata", new String[] { v }));
        if (usePagination) {
            // TODO pagination size per corpus
            // TODO validate against document length (what to do if start >= length? probably just set to 0?)
            final int pageSize = servlet.getWordsToShow();
            Integer wordstart = Math.max(0, this.getParameter("wordstart", 0));
            Integer wordend = this.getParameter("wordend", Integer.MAX_VALUE);
            if (wordend <= wordstart || wordend > (wordstart + pageSize)) { wordend = wordstart + pageSize; }
            if (wordstart <= 0) { wordstart = null; }
            // if (wordend >= documentLength) { wordend = null; }

            if (wordstart != null) { requestParameters.put("wordstart", new String[] { wordstart.toString() }); }
            if (wordend != null) { requestParameters.put("wordend", new String[] { wordend.toString() }); }
        }

        try {
            final QueryServiceHandler articleContentRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus) + "docs/" + URLEncoder.encode(documentId, StandardCharsets.UTF_8.toString()) + "/contents");
            final String documentContents = articleContentRequest.makeRequest(requestParameters);
            final Optional<XslTransformer> articleStylesheet = addParametersToStylesheet(servlet.getStylesheet(corpus, "article", corpusDataFormat));

            // TODO this should check 401 instead.
            if (documentContents.contains("NOT_AUTHORIZED")) return "<h1>Content restricted</h1>\nThe webmaster has disabled direct access to the documents in this corpus";
            // We have a stylesheet - assume it's xml content
            if (articleStylesheet.isPresent()) return articleStylesheet.get().transform(documentContents); 
            // When it's not xml just replace the inserted hl tags and pass on
            if (!XML_TAG_PATTERN.matcher(documentContents).find()) return "<pre>" + StringUtils.replaceEach(documentContents, new String[] {"<hl>", "</hl>"}, new String[] { "<span class=\"hl\">", "</span>"}) + "</pre>";
            // It looks like xml, but no stylesheet - return using the default transformer
            return defaultTransformer.transform(documentContents);
        } catch (UnsupportedEncodingException e) { // is subclass of IOException, but is thrown by URLEncoder instead of signifying network error - consider this fatal
            throw new RuntimeException(e);
        } catch (QueryException e) {
            return "Unexpected blacklab response: " + e.getMessage() + " (code " + e.getHttpStatusCode() + ")";
        } catch (IOException e) {
            return "Error while retrieving document metadata: " + e.getMessage();
        } catch (TransformerException e) {
        	return "Could not prepare document for viewing (it might be malformed xml, or there is an error in the stylesheet)\n" + e.getMessageAndLocation(); // TODO: return this separately
        }
    }

    @Override
    protected void completeRequest() throws IOException {
        try {
            // parameters for the requesting of metadata and content from blacklab
            final String pid = getDocPid();
            final Optional<String> userId = Optional.ofNullable(MainServlet.getCorpusOwner(corpus));

            final CorpusConfig blacklabCorpusInfo = getCorpusConfig();
            final WebsiteConfig interfaceConfig = servlet.getWebsiteConfig(corpus);

            final String metadata = getMetadata(pid, userId, blacklabCorpusInfo.getCorpusDataFormat());
            final String content = getContent(pid, userId, blacklabCorpusInfo.getCorpusDataFormat(), interfaceConfig.usePagination());

            context.put("article_meta", metadata);
            context.put("article_content", content);
            context.put("docId", pid);
            context.put("pageSize", interfaceConfig.usePagination() ? servlet.getWordsToShow() : "undefined");
            displayHtmlTemplate(servlet.getTemplate("article"));
        } catch (ActionableException e) {
            response.sendError(e.httpCode, e.message.orElseGet(null));
            return;
        }
    }
}
