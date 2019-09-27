package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.QueryServiceHandler.QueryException;
import nl.inl.corpuswebsite.utils.XslTransformer;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.tuple.MutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.velocity.VelocityContext;

import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;
import java.io.IOException;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    @Override
    protected void completeRequest() throws IOException {
        if (pathParameters.size() != 1) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid document id format " + StringUtils.join(pathParameters, '/'));
            return;
        }

        String pid = pathParameters.get(0);
        if (pid == null || pid.isEmpty()) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        Pair<CorpusConfig, Exception> blackLabInfo = servlet.getCorpusConfig(corpus);
        if (blackLabInfo.getRight() != null) {
            Exception e = blackLabInfo.getRight();
            String message = "Error retrieving corpus information" + (e.getMessage() != null ? ": " + e.getMessage() : "");
            int code = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
            if (e instanceof QueryException) {
                QueryException qe = (QueryException) e;
                code = qe.getHttpStatusCode();
                    
                if (code == HttpServletResponse.SC_NOT_FOUND) {
                    message = null;
                } else {
                    message = "Error retrieving corpus information - unexpected BlackLab response.";
                }
            }

            if (message != null) {
                response.sendError(code, message);
            } else { 
                response.sendError(code);
            }
            return;
        }

        CorpusConfig cfg = blackLabInfo.getLeft();
        String formatIdentifier = cfg.getCorpusDataFormat();
        Optional<XslTransformer> articleStylesheet = servlet.getStylesheet(corpus, "article", formatIdentifier);
        Optional<XslTransformer> metadataStylesheet = servlet.getStylesheet(corpus, "meta", formatIdentifier);

        QueryServiceHandler articleContentRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus) + "docs/" + pid + "/contents");
        QueryServiceHandler articleMetadataRequest = new QueryServiceHandler(servlet.getWebserviceUrl(corpus) + "docs/" + pid);

        // get parameter values
        String query = this.getParameter("query", "");
        String pattGapData = this.getParameter("pattgapdata", "");
        String userId = MainServlet.getCorpusOwner(corpus);

        Map<String, String[]> contentRequestParameters = new HashMap<>();
        Map<String, String[]> metadataRequestParameters = new HashMap<>();

        if (query != null && !query.isEmpty()) {
            contentRequestParameters.put("patt", new String[] { query });
            if (pattGapData != null && !pattGapData.isEmpty()) {
                contentRequestParameters.put("pattgapdata", new String[] { pattGapData });
            }
        }
        if (userId != null && !userId.isEmpty()) {
            contentRequestParameters.put("userid", new String[] { userId });
            metadataRequestParameters.put("userid", new String[] { userId });
        }

        context.put("docId", pid);

        try {
            PagingInfo pi = getMetadata(metadataStylesheet,articleMetadataRequest, query, pattGapData, metadataRequestParameters, context);

            // show max. 5000 (or as requested/configured) words of content (TODO: paging)
            // paging will also need edits in blacklab,
            // since when you only get a subset of the document without begin and ending, the top of the xml tree will be missing
            // and xslt will not match anything (or match the wrong elements)
            // so blacklab will have to walk the tree and insert those tags in some manner.
            if (servlet.getWebsiteConfig(this.corpus).usePagination()) {
                contentRequestParameters.putAll(pi.getBlacklabQuery());
            }

            // NOTE: document not necessarily xml, though it might have some <hl/> tags injected to mark query hits
            String documentContents = articleContentRequest.makeRequest(contentRequestParameters);
            if (documentContents.contains("NOT_AUTHORIZED")) {
                context.put("article_content", "content restricted");
            } else {
                context.put("article_content", transformContent(articleStylesheet, documentContents));
            }

        } catch (QueryException e) {
            if (e.getHttpStatusCode() == 404) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
                return;
            }

            response.sendError(HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
            return;
        }


        // display template
        displayHtmlTemplate(servlet.getTemplate("article"));
    }

    private String transformContent(Optional<XslTransformer> articleStylesheet, String documentContents) {
        return articleStylesheet.map(t -> {  // probably xml, or we wouldn't have a stylesheet
            t.clearParameters();
            t.addParameter("contextRoot", servlet.getServletContext().getContextPath());
            servlet.getWebsiteConfig(corpus).getXsltParameters().forEach(t::addParameter);

            try {
                return t.transform(documentContents);
            } catch (TransformerException e) {
                return null; // proceed to orElseGet
            }
        })
        .orElseGet(() -> {
            if (!XML_TAG_PATTERN.matcher(documentContents).find()) {
                // not xml, just replace the inserted hl tags and pass on
               return "<pre>" + StringUtils.replaceEach(documentContents,
                                               new String[] {"<hl>", "</hl>"},
                                               new String[] { "<span class=\"hl\">", "</span>"}) +
               "</pre>";
            }

            // seems to contain at least one xml opening/self-closing tag, process using default xslt
            try {
                return defaultTransformer.transform(documentContents);
            } catch (TransformerException e) {
                // Document seems to be xml, but probably not valid, we tried...
                return "Could not prepare document for viewing (it might be malformed xml) - " + e.getMessage();
            }
        });
    }

    /**
     *
     * @param metadataStylesheet
     * @param articleMetadataRequest
     * @param query
     * @param pattGapData
     * @param metadataRequestParameters
     * @param context
     * @return PagingInfo holding info for paging
     */
    private PagingInfo getMetadata(Optional<XslTransformer> metadataStylesheet, QueryServiceHandler articleMetadataRequest, String query, String pattGapData, Map<String, String[]> metadataRequestParameters, VelocityContext context) {
        return metadataStylesheet
                .map(t -> {
                    MutablePair<XslTransformer, String> p = new MutablePair<>();

                    try {
                        String meta = articleMetadataRequest.makeRequest(metadataRequestParameters);
                        p.left = t;
                        p.right = meta;
                        return p;
                    } catch (QueryException | IOException e) {
                        return null;
                    }
                })
                .map(p -> {
                    XslTransformer t = p.left;
                    String meta = p.right;

                    Matcher m = CAPTURE_DOCLENGTH_PATTERN.matcher(meta);
                    PagingInfo pi = new PagingInfo(this, servlet.getWordsToShow(),m.find()?Integer.parseInt(m.group(1)):0);
                    if (servlet.getWebsiteConfig(this.corpus).usePagination()) {
                        String q = (query != null && !query.isEmpty()) ? ("&query="+esc.url(query)) : "";
                        String pg = (pattGapData != null && !pattGapData.isEmpty()) ? "&pattgapdata="+esc.url(pattGapData) : "";

                        context.put("docLength",pi.getDocLength());
                        context.put("pageStart",pi.getStart());
                        // number of words shown calculated: page end or doclength minus 0 or pagestart
                        context.put("wordsShown",pi.wordsShown());
                        if (pi.hasPrev()) {
                            context.put("first_page", "?" + pi.firstUrlQuery()+q+pg);
                            context.put("previous_page", "?"+pi.prevUrlQuery()+q+pg);
                        }
                        if (pi.hasNext()) {
                            context.put("next_page", "?"+pi.nextUrlQuery() + pg + q);
                            context.put("last_page", "?"+pi.lastUrlQuery() + pg + q);
                        }
                    }

                    try {
                        context.put("article_meta", t.transform(meta));
                    } catch (TransformerException e) {
                        context.put("article_meta", "");
                    }
                    return pi;
                })
                .orElseGet(() -> {
                    context.put("article_meta", "");
                    return new PagingInfo(this,servlet.getWordsToShow(),0);
                });
    }
}
