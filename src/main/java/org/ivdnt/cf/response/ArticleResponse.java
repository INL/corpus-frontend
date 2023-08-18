package org.ivdnt.cf.response;

import java.io.IOException;
import java.io.StringReader;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.transform.TransformerException;

import org.apache.commons.lang3.StringUtils;
import org.ivdnt.cf.BaseResponse;
import org.ivdnt.cf.utils.BlackLabApi;
import org.ivdnt.cf.utils.CorpusConfig;
import org.ivdnt.cf.utils.QueryException;
import org.ivdnt.cf.utils.Result;
import org.ivdnt.cf.utils.ReturnToClientException;
import org.ivdnt.cf.utils.WebsiteConfig;
import org.ivdnt.cf.utils.XslTransformer;

import jakarta.servlet.http.HttpServletResponse;

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
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public ArticleResponse() {
        super("article", true);
    }

    private String getDocPid() {
        if (pathParameters.size() != 1) {
            throw new ReturnToClientException(
                    HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid document id format " + StringUtils.join(pathParameters, '/') + " - should just be a single string, with any contained slashes encoded."
            );
        }

        String pid = pathParameters.get(0);
        if (pid == null || pid.isEmpty()) {
            throw new ReturnToClientException(HttpServletResponse.SC_NOT_FOUND);
        }
        return pid;
    }

    private CorpusConfig getCorpusConfig() {
        BlackLabApi api = new BlackLabApi(request, response);
        String corpus = this.corpus.orElseThrow(RuntimeException::new); // should never happen
        return api.getCorpusConfig(corpus).getOrThrow(ReturnToClientException::new);
    }

    protected String transformMetadata(String rawMetadata) {
        Optional<String> corpusDataFormat = getCorpusConfig().getCorpusDataFormat();
        return servlet.getStylesheet(corpus, "meta", corpusDataFormat, request, response)
                .mapWithErrorHandling(trans -> trans.transform(rawMetadata))
                .recover(Exception::getMessage)
                .getResult().orElse("Error during transformation of metadata");
    }


    /**
     * Get the article content and transform it for display.
     * If an error occurs at any point (failed to load content, failed to load stylesheet, failed to apply stylesheet) an informative
     * message is returned in the string, and the exception is returned separately so the client can debug it.
     *
     * NOTE: assumes pageStart and pageEnd are validated and correct, they are not sent to BlackLab if they are -1
     *
     * @param documentId
     * @param corpusDataFormat
     * @param pageStart
     * @param pageEnd
     * @return
     */
    protected Result<String, Exception> getTransformedContent(String documentId, Optional<String> corpusDataFormat, Optional<Integer> pageStart, Optional<Integer> pageEnd) {

        return new BlackLabApi(request, response).getDocumentContents(
                        corpus.orElseThrow(),
                        documentId,
                        Optional.ofNullable(this.getParameter("query", (String) null)),
                        Optional.ofNullable(this.getParameter("pattgapdata", (String) null)),
                        pageStart,
                        pageEnd
                ).flatMap(content -> {
                    if (!XML_TAG_PATTERN.matcher(content).find()) {
                        return Result.success("<pre>" + StringUtils.replaceEach(content, new String[] { "<hl>", "</hl>" },
                                new String[] { "<span class=\"hl\">", "</span>" }) + "</pre>");
                    }

                    return servlet
                            .getStylesheet(corpus, "article", corpusDataFormat, request, response)
                            .mapWithErrorHandling(transformer -> {
                                transformer.addParameter("contextRoot", servlet.getServletContext().getContextPath());
                                servlet.getWebsiteConfig(corpus, request, response).getXsltParameters()
                                        .forEach(transformer::addParameter);
                                return transformer.transform(content);
                            });
                })
                .recoverWithErrorHandling(QueryException.class, e -> {
                    if (e.getHttpStatusCode() == 401) throw new ArticleContentRestrictedException();
                    return e.getMessage();
                });
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

        public PaginationInfo(boolean usePagination, int pageSize, Result<String, ? extends Exception> documentMetadata, int requestedPageStart, int requestedPageEnd) {
            if (documentMetadata.getResult().isEmpty()) { // uhh, an error in the metadata, can't determine document length. Shouldn't matter though, just show the entire document.
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
            this.documentLength = getDocumentLength(documentMetadata.getResult().get());
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
        BlackLabApi api = new BlackLabApi(this.request, this.response);

        // parameters for the requesting of metadata and content from blacklab
        final String pid = getDocPid();

        final CorpusConfig blacklabCorpusInfo = getCorpusConfig();
        final WebsiteConfig interfaceConfig = servlet.getWebsiteConfig(this.corpus, this.request, this.response);

        final Result<String, QueryException> rawMetadata = api.getDocumentMetadata(corpus.get(), pid);
        final Result<String, QueryException> transformedMetadata = rawMetadata.map(this::transformMetadata);
        PaginationInfo pi = new PaginationInfo(interfaceConfig.usePagination(), interfaceConfig.getPageSize(), rawMetadata, getParameter("wordstart", 0), getParameter("wordend", Integer.MAX_VALUE));
        final Result<String, Exception> transformedContent = getTransformedContent(pid, blacklabCorpusInfo.getCorpusDataFormat(), pi.blacklabPageStart, pi.blacklabPageEnd);

        context.put("article_meta", transformedMetadata.getResult().orElse(""));
        context.put("article_meta_error", transformedMetadata.getError().orElse(null));
        context.put("article_content_restricted", transformedContent.getError().filter(e -> e instanceof ArticleContentRestrictedException).isPresent());
        context.put("article_content", transformedContent.getResult().orElse("An error occurred while retrieving the document contents"));
        context.put("article_content_error", transformedContent.getError().orElse(null));
        context.put("docId", pid);
        context.put("docLength", pi.documentLength);
        context.put("paginationEnabled", pi.paginationEnabled);
        context.put("pageSize", pi.pageSize);
        context.put("pageStart", pi.clientPageStart);
        context.put("pageEnd", pi.clientPageEnd);

        displayHtmlTemplate(servlet.getTemplate("article"));
    }
}