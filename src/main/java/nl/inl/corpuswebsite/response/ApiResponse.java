package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;

import net.sf.saxon.lib.Logger;
import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.BlackLabApi;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.CorpusFileUtil;
import nl.inl.corpuswebsite.utils.GlobalConfig;
import nl.inl.corpuswebsite.utils.GlobalConfig.Keys;
import nl.inl.corpuswebsite.utils.QueryException;
import nl.inl.corpuswebsite.utils.Result;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 * We need a rudimentary API for some of the content that needs to processed serverside.
 * At the moment that's these 3 items:
 * - document metadata      /${corpus}/api/docs/${id}           - show the metadata for the document, transformed with the 'meta.xsl' stylesheet for the corpus.
 * - document contents      /${corpus}/api/docs/${id}/contents  - show the document's content, transformed with the appropriate 'article.xsl' stylesheet for the corpus.
 * - index metadata         /${corpus}/api/info                 - Return a json of the indexmetadata from BlackLab, but with annotation values listed.
 * <br>
 *  We needed an API because there's a chicken-and-egg situation when rendering a page for which a user would need to log in.
 *  To show the search page, we require the corpus metadata from BL, but to get it, we need user credentials, but to get those, the user needs a page to log in.
 *  So that doesn't work. Instead, split up page loading into two stages
 *  - initial setup, which renders a login button, etc.
 *  - population/hydration, which downloads the relevant info from this API, which now becomes possible, because the user has had the change to log in.
 */
public class ApiResponse extends BaseResponse {
    /** Default transformer that translates <hl> tags into highlighted spans and outputs all text */
    private static final XslTransformer defaultTransformer;

    /** Matches xml open/void tags &lt;namespace:tagname attribute="value"/&gt; excluding hl tags, as those are inserted by blacklab and can result in false positives */
    private static final Pattern XML_TAG_PATTERN = Pattern.compile("<([\\w]+:)?((?!(hl|blacklabResponse|[xX][mM][lL])\\b)[\\w.]+)(\\s+[\\w\\.:]+=\"[:/()='+\\-\\w\\s,]*\")*/?>");

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
                            "</xsl:stylesheet>")
            );
            // @formatter:on
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public ApiResponse() {
        super("api", true);
    }

    // TODO this could probably be cleaned up a little.
    @Override
    protected void completeRequest() throws QueryException {
        if (pathParameters.isEmpty()) throw new QueryException(HttpServletResponse.SC_NOT_FOUND, "No endpoint specified");
        String operation = pathParameters.get(0);
        if (operation.equalsIgnoreCase("docs")) {
            if (pathParameters.size() < 2) throw new QueryException(HttpServletResponse.SC_NOT_FOUND, "No document specified. Expected ${corpus}/docs/${docid}[/contents]");
            String document = pathParameters.get(1);
            boolean isContents = pathParameters.size() > 2 && pathParameters.get(2).equalsIgnoreCase("contents");
            if (isContents) documentContents(document);
            else documentMetadata(document);
        } else if (operation.equalsIgnoreCase("info")) {
            indexMetadata();
        } else throw new QueryException(HttpServletResponse.SC_NOT_FOUND, "Unknown endpoint " + operation);
    }

    protected void documentContents(String docId) {
        Optional<String> query = Optional.ofNullable(request.getParameter("query"));
        Optional<String> pattgapdata = Optional.ofNullable(request.getParameter("pattgapdata"));
        Optional<Integer> pagestart = Optional.ofNullable(request.getParameter("wordstart")).map(Integer::parseInt); // when non-parseable just throw a 500 (or bad request?), we don't care.
        Optional<Integer> pageend = Optional.ofNullable(request.getParameter("wordend")).map(Integer::parseInt);
        /* Which flavour of xml are the documents. Used to pick the right stylesheet. */
        Optional<String> documentType = Optional.ofNullable(request.getParameter("documentType"));

        new BlackLabApi(request, response, servlet.getGlobalConfig())
            .getDocumentContents(
                corpus.orElseThrow(),
                docId,
                query,
                pattgapdata,
                pagestart.filter(s -> s > 0), // when start = 0, remove it entirely (or blacklab will strip off content before the first token, i.e. headers etc).
                pageend.filter(e -> e > 0 && e > pagestart.orElse(0))
            )
            // If there's already an error, it's a web error.
            // Polish the message a bit.
            .mapError(e -> {
                // when blacklab returns 401, we need to return a 401 to the user (unauthorized - IE you can't do this unless you log in - please log in and try again)
                if (e.getHttpStatusCode() == HttpServletResponse.SC_UNAUTHORIZED) return new QueryException(HttpServletResponse.SC_UNAUTHORIZED, "Please log in to view this document.");
                // when blacklab returns 403, we need to also return 403, (forbidden - IE you're logged in, but you're still not allowed.)
                if (e.getHttpStatusCode() == HttpServletResponse.SC_FORBIDDEN) return new QueryException(HttpServletResponse.SC_FORBIDDEN, "Documents in this corpus cannot be displayed, because the owner has disabled this feature.");
                else return new QueryException(e.getHttpStatusCode(), "An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage());
            })
            .flatMap(c -> {
                // If the document contents aren't xml, don't bother with the transformer.
                if (!XML_TAG_PATTERN.matcher(c).find()) {
                    return Result.success("<pre>" + StringUtils.replaceEach(c,
                            new String[] { "<hl>", "</hl>" },
                            new String[] { "<span class=\"hl\">", "</span>" }
                    ) + "</pre>");
                }

                // we managed to get the contents, and they're definitely xml.
                // Load the transformer.

                GlobalConfig config = servlet.getGlobalConfig();
                return CorpusFileUtil.getStylesheet(
                    config.get(Keys.CORPUS_CONFIG_DIR),
                    corpus,
                    Optional.ofNullable(config.get(Keys.DEFAULT_CORPUS_CONFIG)),
                    "article",
                    documentType,
                    request,
                    response,
                    config
                )
                .or(defaultTransformer) // don't use recover() - we have to surface exceptions to the user (and recover() clears exceptions), or() doesn't.
                .tap(trans -> trans.addParameter("contextRoot", request.getServletContext().getContextPath())) // search.xml - this variable should always be defined.
                .mapWithErrorHandling(trans -> trans.transform(c))
                .mapError(e -> new QueryException(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "An error occurred while transforming document contents: \n" + e.getMessage() + "\n" + ExceptionUtils.getStackTrace(e)));
            })
            .tapSelf(r -> sendResult(r, "text/html; charset=utf-8"));
    }

    protected void documentMetadata(String docId) {
        GlobalConfig config = servlet.getGlobalConfig();

        Result<String, QueryException> result = new BlackLabApi(request, response, servlet.getGlobalConfig())
            .getDocumentMetadata(corpus.orElseThrow(), docId)
            .mapError(e -> {
                // when blacklab returns 401, we need to return a 401 to the user (unauthorized - IE you can't do this unless you log in - please log in and try again)
                // when blacklab returns 403, we need to also return 403, (forbidden - IE you're logged in, but you're still not allowed.)
                if (e.getHttpStatusCode() == HttpServletResponse.SC_UNAUTHORIZED) return new QueryException(HttpServletResponse.SC_UNAUTHORIZED, "Please log in to view this document.");
                if (e.getHttpStatusCode() == HttpServletResponse.SC_FORBIDDEN) return new QueryException(HttpServletResponse.SC_FORBIDDEN, "Administrator has restricted access to this document.");
                else return new QueryException(e.getHttpStatusCode(), "An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage());
            })
            .flatMap(metadata ->
                CorpusFileUtil.getStylesheet(
                        config.get(Keys.CORPUS_CONFIG_DIR),
                        corpus,
                        Optional.ofNullable(config.get(Keys.DEFAULT_CORPUS_CONFIG)),
                        "meta",
                        Optional.empty(),
                        request,
                        response,
                        config
                )
                .tap(trans -> trans.addParameter("contextRoot", request.getServletContext().getContextPath())) // search.xml - this variable should always be defined.
                .mapWithErrorHandling(trans -> trans.transform(metadata))
                .mapError(e -> new QueryException(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "An error occurred while transforming document contents: \n" + e.getMessage() + "\n" + ExceptionUtils.getStackTrace(e)))
            )
            .tapSelf(r -> sendResult(r, "text/html; charset=utf-8"));
    }

    protected void indexMetadata() {
        long now = System.currentTimeMillis();

        servlet.getCorpusConfig(corpus, request, response)
            .mapError(QueryException::wrap)
            .map(CorpusConfig::getJsonUnescaped)
            .tapSelf(r -> {
                sendResult(r, "application/json; charset=utf-8");
                logger.fine("Corpus metadata request took " + (System.currentTimeMillis() - now) + "ms");
            });
    }

    protected void sendResult(Result<String, QueryException> r, String contentType) {
        r.ifPresentOrElse(contents -> {
            try {
                response.setHeader("Content-Type", contentType);
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.getWriter().write(contents);
                response.flushBuffer();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }, error -> {
            try {
                response.setStatus(error.getHttpStatusCode());
                response.getWriter().print(error.getMessage());
                response.flushBuffer();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }
}
