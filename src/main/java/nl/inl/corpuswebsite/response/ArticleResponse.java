package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.QueryServiceHandler.QueryException;
import nl.inl.corpuswebsite.utils.XslTransformer;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.tuple.MutablePair;

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
        String formatIdentifier = servlet.getCorpusConfig(corpus).getCorpusDataFormat();
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

        // show max. 5000 (or as requested/configured) words of content (TODO: paging)
        // paging will also need edits in blacklab,
        // since when you only get a subset of the document without begin and ending, the top of the xml tree will be missing
        // and xslt will not match anything (or match the wrong elements)
        // so blacklab will have to walk the tree and insert those tags in some manner.
        if (servlet.getWebsiteConfig(this.corpus).usePagination()) {
            contentRequestParameters.put("wordstart", new String[] { Integer.toString(getWordStart(-1)) });
            contentRequestParameters.put("wordend", new String[] { Integer.toString(getWordEnd(-1)) });
        }

        context.put("docId", pid);

        try {
            // NOTE: document not necessarily xml, though it might have some <hl/> tags injected to mark query hits
            String documentContents = articleContentRequest.makeRequest(contentRequestParameters);
            if (documentContents.contains("NOT_AUTHORIZED")) {
                context.put("article_content", "content restricted");
            } else {
                context.put("article_content",
                    articleStylesheet.map(t -> {  // probably xml, or we wouldn't have a stylesheet
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
                    })
                );
            }

            context.put("article_meta", metadataStylesheet
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
                    if (servlet.getWebsiteConfig(this.corpus).usePagination() && m.find()) {
                        int docLength = Integer.parseInt(m.group(1));
                        int pageStart = getWordStart(-1); // can be -1 to show content before first word
                        int pageEnd = getWordEnd(docLength); // can be -1 to show content after last word
                        int pageSize = servlet.getWordsToShow();
                        String q = (query != null && !query.isEmpty()) ? ("&query="+esc.url(query)) : "";
                        String pg = (pattGapData != null && !pattGapData.isEmpty()) ? "&pattgapdata="+esc.url(pattGapData) : "";

                        context.put("docLength",docLength);
                        context.put("pageStart",Math.max(0,pageStart));
                        // number of words shown calculated: page end or doclength minus 0 or pagestart
                        context.put("wordsShown",Math.max(pageSize,pageEnd==-1?docLength:pageEnd)-Math.max(0,pageStart));
                        if (pageStart > 0) {
                            context.put("first_page", "?wordstart=0&wordend="+pageSize+q+pg);
                            context.put("previous_page", "?wordstart="+Math.max(0, pageStart-pageSize)+"&wordend="+pageStart+q+pg);
                        }
                        if (pageEnd!=-1 && pageEnd < docLength) {
                            context.put("next_page", "?wordstart="+(pageEnd)+"&wordend="+Math.min(pageEnd+pageSize, docLength)+q+pg);
                            context.put("last_page", "?wordstart="+(docLength-pageSize)+"&wordend="+(docLength)+q+pg);
                        }
                    }

                    try {
                        return t.transform(meta);
                    } catch (TransformerException e) {
                        return null;
                    }
                })
                .orElse("")
            );
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

    /**
     *
     * @param first the default and max for the start word (-1 to have blacklab return content before first word)
     * @return the value of parameter wordstart or first when wordstart not set or greater than first
     */
    private int getWordStart(int first) {
        return Math.max(first, getParameter("wordstart", first));
    }

    /**
     *
     * @param docLength the length of the document OR -1
     * @return the value of parameter wordend or {@link MainServlet#getWordsToShow()}, or -1 when greater or equal the
     * doclength to have blacklab return content after last word
     */
    private int getWordEnd(int docLength) {
        int maxWordCount = servlet.getWordsToShow();
        //  get 0 based wordstart for calculation of wordend
        int wordStart = getWordStart(0);
        int end = wordStart + Math.min(Math.max(0, getParameter("wordend", maxWordCount)), maxWordCount);
        return docLength != -1 && end >= docLength ? -1 : end;
    }
}
