package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.tuple.Pair;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.QueryException;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.corpuswebsite.utils.XslTransformer;

public class ArticleResponse extends BaseResponse {

	private static class ArticleContentRestrictedException extends Exception {}
	
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
                    "<xsl:template match=\"text()\">\r\n" +
                        "<xsl:value-of select=\"replace(., '[&#x007F;-&#x009F;]', ' ')\"/>\r\n" +
                    "</xsl:template>" +
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
        super("article", true);
    }

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
                    e.getHttpStatusCode() == HttpServletResponse.SC_NOT_FOUND ? "Unknown corpus '" + corpus.get() + "'" : e.getMessage()
            );
        } else if (blackLabInfo.getRight() != null) {
            Exception e = blackLabInfo.getRight();
            if (e instanceof UnknownHostException) {
                throw new ActionableException(HttpServletResponse.SC_NOT_FOUND, "Error retrieving corpus information, unknown host: " + e.getMessage());
            } else if (e instanceof QueryException) {
                throw new ActionableException(((QueryException) e).getHttpStatusCode(), e.getMessage());
            } else {
                throw new ActionableException(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
            }
        } else if (blackLabInfo.getLeft() == null) {
            throw new ActionableException(HttpServletResponse.SC_NOT_FOUND, "Unknown corpus '"+corpus.get()+"'");
        }
        return blackLabInfo.getLeft();
    }

    /**
     * Fetch the document's metadata from blacklab and return it.
     * In case of errors, a string describing the error will be returned instead of the metadata. The error will also be returned in the right side.
     * @param documentId
     * @param corpusOwner
     * @return
     * @throws ActionableException when the document cannot be found
     */
    protected Pair<String, Optional<Exception>> getRawMetadata(String documentId, Optional<String> corpusOwner) throws ActionableException {
        try {
            final QueryServiceHandler articleMetadataRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus.get()) + "docs/" + URLEncoder.encode(documentId, StandardCharsets.UTF_8.toString()));
            final Map<String, String[]> requestParameters = new HashMap<>();
            corpusOwner.ifPresent(s -> requestParameters.put("userid", new String[] { s }));
            final String metadata = articleMetadataRequest.makeRequest(requestParameters);
            return Pair.of(metadata, Optional.empty());
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

    protected Pair<String, Optional<Exception>> transformMetadata(Pair<String, Optional<Exception>> rawMetadata, Optional<String> corpusDataFormat) {
        try {
            if (rawMetadata.getRight().isPresent()) { return rawMetadata; } // There's something wrong with the metadata, pass on the error message and don't do anything here.
            final Pair<Optional<XslTransformer>, Optional<Exception>> transformerAndError = servlet.getStylesheet(corpus.get(), "meta", corpusDataFormat);
            if (transformerAndError.getRight().isPresent()) { return Pair.of("<h1>Error in metadata stylesheet</h1>", transformerAndError.getRight()); }
            if (!transformerAndError.getLeft().isPresent()) { // this should always exist, we have a builtin fallback stylesheet after all...
                return Pair.of("Cannot display metadata - misconfigured server, missing metadata stylesheet (meta.xsl) - see README.MD, section #frontend-configuration", Optional.empty());
            }

            final XslTransformer trans = addParametersToStylesheet(transformerAndError.getLeft()).get();
            final String result = trans.transform(rawMetadata.getLeft());
            return Pair.of(result, Optional.empty());
        } catch (TransformerException e) {
            return Pair.of("<h1>Error during transformation of metadata</h1>", Optional.of(e));
        }
    }

    protected Optional<XslTransformer> addParametersToStylesheet(Optional<XslTransformer> transformer) {
        transformer.ifPresent(t -> {
            t.addParameter("contextRoot", servlet.getServletContext().getContextPath());
            servlet.getWebsiteConfig(corpus).getXsltParameters().forEach(t::addParameter);
        });
        return transformer;
    }

    /**
     * Get the article content and transform it for display.
     * If an error occurs at any point (failed to load content, failed to load stylesheet, failed to apply stylesheet) an informative
     * message is returned in the string, and the exception is returned separately so the client can debug it.
     *
     * NOTE: assumes pageStart and pageEnd are validated and correct, they are not sent to BlackLab if they are -1
     *
     * @param documentId
     * @param corpusOwner
     * @param corpusDataFormat
     * @param pageStart
     * @param pageEnd
     * @return
     * @throws ActionableException 404 when the article doesn't exist
     */
    protected Pair<String, Optional<Exception>> getTransformedContent(String documentId, Optional<String> corpusOwner, Optional<String> corpusDataFormat, Optional<Integer> pageStart, Optional<Integer> pageEnd) throws ActionableException {
        final HashMap<String, String[]> requestParameters = new HashMap<>();
        corpusOwner.ifPresent(v -> requestParameters.put("userid", new String[] { v }));
        Optional.ofNullable(this.getParameter("query", (String) null)).ifPresent(v -> requestParameters.put("patt", new String[] { v }));
        Optional.ofNullable(this.getParameter("pattgapdata", (String) null)).ifPresent(v -> requestParameters.put("pattgapdata", new String[] { v }));
        pageStart.ifPresent(s -> requestParameters.put("wordstart", new String[] { s.toString() }));
        pageEnd.ifPresent(s -> requestParameters.put("wordend", new String[] { s.toString() }));
        try {
            final QueryServiceHandler articleContentRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus.get()) + "docs/" + URLEncoder.encode(documentId, StandardCharsets.UTF_8.toString()) + "/contents");
            final String documentContents = articleContentRequest.makeRequest(requestParameters);
            // TODO this should check 401 instead.
            if (documentContents.contains("NOT_AUTHORIZED")) return Pair.of("<h1>Content restricted</h1>\nThe webmaster has disabled direct access to the documents in this corpus", Optional.of(new ArticleContentRestrictedException()));

            Exception error = null;
            XslTransformer trans = null;
            Pair<Optional<XslTransformer>, Optional<Exception>> transformerAndError = servlet.getStylesheet(corpus.get(), "article", corpusDataFormat);

            error = transformerAndError.getRight().orElse(null);
            trans = transformerAndError.getLeft().orElse(null);

            // No hand-written transformer for this type (article.xsl or our builtin article_tei.xsl and friends), and no blacklab auto-generated transformer either.
            // load the fallback transformer that just outputs all text.
            // NOTE: don't do this is the stylesheet simply failed to load due to an error, so that we can actually expose the error to devs/users.
            if (trans == null && (error == null || error instanceof QueryException && ((QueryException) error).getHttpStatusCode() == 404)) {
                // Only load the fallback if this is actually xml, otherwise just string-replace the highlighted words with spans and return as-is (this might not be an xml corpus!)
                if (!XML_TAG_PATTERN.matcher(documentContents).find()) return Pair.of("<pre>" + StringUtils.replaceEach(documentContents, new String[] {"<hl>", "</hl>"}, new String[] { "<span class=\"hl\">", "</span>"}) + "</pre>", Optional.empty());
                trans = defaultTransformer;
                error = null;
            }

            // Always transform if we can.
            String output = trans != null ? addParametersToStylesheet(Optional.of(trans)).get().transform(documentContents) : error != null ? "<h1>Error in article stylesheet</h1>" : "Could not prepare document for viewing - missing article stylesheet.";
            return Pair.of(output, Optional.ofNullable(error));
        } catch (UnsupportedEncodingException e) { // is subclass of IOException, but is thrown by URLEncoder instead of signifying network error - consider this fatal
            throw new RuntimeException(e);
        } catch (QueryException e) {
            if (e.getHttpStatusCode() == HttpServletResponse.SC_NOT_FOUND) { throw new ActionableException(HttpServletResponse.SC_NOT_FOUND, "Unknown document '" + documentId + "'"); }
            else return Pair.of("Unexpected blacklab response: " + e.getMessage() + " (code " + e.getHttpStatusCode() + ")", Optional.of(e));
        } catch (UnknownHostException e) {
              return Pair.of("Error while retrieving document contents, unknown host: " + e.getMessage(), Optional.of(e));
        } catch (IOException e) {
            return Pair.of("Error while retrieving document contents: " + e.getMessage(), Optional.of(e));
        } catch (TransformerException e) {
            return Pair.of("Could not prepare document for viewing (it might be malformed xml, or there is an error in the stylesheet)\n" + e.getMessageAndLocation(), Optional.of(e)); // TODO: return this separately
        }
    }

    /**
     * Since pagination can be disabled, edited by the user through the url, and BlackLab has some peculiarities with values touching document boundaries,
     * We correct the values.
     * Try to keep pageStart static (as long as it is within the document), and slide pageEnd around if it's invalid (negative range, too large).
     *
     * Apply the following rules:
     * - the client only sees numbers within [0, documentLength],
     * - BlackLab sees numbers [1, documentLength - 1], or an omitted value if the value would touch a boundary.
     */
    private static class PaginationInfo {
        public final int pageSize;
        public final int documentLength;
        public final boolean paginationEnabled;

        public final int clientPageStart;
        public final int clientPageEnd;
        public final Optional<Integer> blacklabPageStart;
        public final Optional<Integer> blacklabPageEnd;

        public PaginationInfo(boolean usePagination, int pageSize, Pair<String, Optional<Exception>> documentMetadata, int requestedPageStart, int requestedPageEnd) {
            if (documentMetadata.getRight().isPresent()) { // uhh, an error in the metadata, can't determine document length. Shouldn't matter though, just show the entire document.
                this.pageSize = pageSize;
                this.documentLength = 1000;
                this.clientPageEnd = 0;
                this.clientPageStart = Integer.MAX_VALUE;
                this.blacklabPageEnd = Optional.empty();
                this.blacklabPageStart = Optional.empty();
                this.paginationEnabled = false;
                return;
            }

            this.pageSize = pageSize;
            this.documentLength = getDocumentLength(documentMetadata.getLeft());
            this.paginationEnabled = usePagination;

            if (!usePagination) {
                this.clientPageStart = 0;
                this.clientPageEnd = documentLength;
                this.blacklabPageStart = Optional.empty();
                this.blacklabPageEnd = Optional.empty();
                return;
            }

            if (requestedPageStart >= documentLength || requestedPageStart <= 0) { requestedPageStart = 0; }
            requestedPageEnd = Math.min(Math.min(requestedPageEnd, documentLength), requestedPageStart + pageSize); // clamp if too large (above doclength or above allowed page size)
            if (requestedPageEnd <= requestedPageStart) { requestedPageEnd = Math.min(requestedPageStart + pageSize, documentLength); } // fix if end is before start

            // Now they're bounded to [0, documentLength] This is what we send to the frontend
            this.clientPageStart = requestedPageStart;
            this.clientPageEnd = requestedPageEnd;

            // But if any of the parameters touches a document border, we don't want to send that to BlackLab
            // as it would chop off leading/trailing document contents if we do, instead we don't want to send anything
            this.blacklabPageStart = Optional.of(requestedPageStart).filter(v -> v != 0);
            this.blacklabPageEnd = Optional.of(requestedPageEnd).filter(v -> v != documentLength);
        }
        
        private static int getDocumentLength(String documentMetadata) {
            final Matcher m = CAPTURE_DOCLENGTH_PATTERN.matcher(documentMetadata);
            if (m.find()) {
                return Integer.parseInt(m.group(1));
            } else {
                throw new RuntimeException("Cannot decode document size. Unsupported BlackLab version?");
            }
        }
    }

    @Override
    protected void completeRequest() throws IOException {
        try {
            // parameters for the requesting of metadata and content from blacklab
            final String pid = getDocPid();
            final Optional<String> userId = MainServlet.getCorpusOwner(corpus);

            final CorpusConfig blacklabCorpusInfo = getCorpusConfig();
            final WebsiteConfig interfaceConfig = servlet.getWebsiteConfig(corpus);

            final Pair<String, Optional<Exception>> rawMetadata = getRawMetadata(pid, userId);
            final Pair<String, Optional<Exception>> transformedMetadata = transformMetadata(rawMetadata, blacklabCorpusInfo.getCorpusDataFormat());
            PaginationInfo pi = new PaginationInfo(interfaceConfig.usePagination(), interfaceConfig.getPageSize(), rawMetadata, getParameter("wordstart", 0), getParameter("wordend", Integer.MAX_VALUE));
            final Pair<String, Optional<Exception>> transformedContent = getTransformedContent(pid, userId, blacklabCorpusInfo.getCorpusDataFormat(), pi.blacklabPageStart, pi.blacklabPageEnd);

            context.put("article_meta", transformedMetadata.getLeft());
            context.put("article_meta_error", transformedMetadata.getRight().orElse(null));
            context.put("article_content_restricted", transformedContent.getRight().orElse(null) instanceof ArticleContentRestrictedException);
            context.put("article_content", transformedContent.getLeft());
            context.put("article_content_error", transformedContent.getRight().orElse(null));
            context.put("docId", pid);
            context.put("docLength", pi.documentLength);
            context.put("paginationEnabled", pi.paginationEnabled);
            context.put("pageSize", pi.pageSize);
            context.put("pageStart", pi.clientPageStart);
            context.put("pageEnd", pi.clientPageEnd);

            displayHtmlTemplate(servlet.getTemplate("article"));
        } catch (ActionableException e) {
            response.sendError(e.httpCode, e.message.orElse(null));
            return;
        }
    }
}
