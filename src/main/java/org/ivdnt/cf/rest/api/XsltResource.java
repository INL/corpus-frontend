package org.ivdnt.cf.rest.api;

import java.io.StringReader;
import java.util.Optional;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import org.apache.commons.lang3.StringUtils;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.GlobalConfig.Keys;
import org.ivdnt.cf.utils.BlackLabApi;
import org.ivdnt.cf.utils.CorpusFileUtil;
import org.ivdnt.cf.utils.Result;
import org.ivdnt.cf.utils.XslTransformer;

import jakarta.inject.Singleton;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotAllowedException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;

@Singleton
@Path("/xslt/")
public class XsltResource {

    final GlobalConfig config;

    /** Default transformer that translates <hl> tags into highlighted spans and outputs all text */
    private static final XslTransformer defaultTransformer;

    /** Matches xml open/void tags &lt;namespace:tagname attribute="value"/&gt; excluding hl tags, as those are inserted by blacklab and can result in false positives */
    private static final Pattern XML_TAG_PATTERN = Pattern.compile("<([\\w]+:)?((?!(hl|blacklabResponse|[xX][mM][lL])\\b)[\\w.]+)(\\s+[\\w\\.]+=\"[\\w\\s,]*\")*\\/?>");

//    private static final Pattern CAPTURE_DOCLENGTH_PATTERN = Pattern.compile("<lengthInTokens>\\s*(\\d+)\\s*<\\/lengthInTokens>");

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


    public XsltResource(@Context Application app) {
        config = (GlobalConfig) app.getProperties().get(GlobalConfig.class.getName());
    }

    @GET
    @Produces({MediaType.TEXT_HTML})
    @Path("{corpus}/{document}/content")
    public String documentContents(
            @PathParam ("corpus") String corpus,
            @PathParam ("document") String document,
            @QueryParam("query") String query,
            @QueryParam("pattgapdata") String pattgap,
            @QueryParam("type") String documentType,
            @Context HttpServletRequest request,
            @Context HttpServletResponse response
    ) throws WebApplicationException {
        return documentContents(corpus, document, query, pattgap, Optional.empty(), Optional.empty(), Optional.ofNullable(documentType), request, response).getOrThrow();
    }

    @GET
    @Produces({MediaType.TEXT_HTML})
    @Path("{corpus}/{document}/content/{start}-{end}")
    public Object test(
            @PathParam ("corpus") String corpus,
            @PathParam ("document") String document,
            @PathParam ("start") int start,
            @PathParam ("end") int end,
            @QueryParam("query") String query,
            @QueryParam("pattgapdata") String pattgap,
            @QueryParam("type") String documentType,
            @Context HttpServletRequest request,
            @Context HttpServletResponse response
    ) throws WebApplicationException {
        return documentContents(corpus, document, query, pattgap, Optional.of(start), Optional.of(end), Optional.ofNullable(documentType), request, response).getOrThrow();
    }

    @GET
    @Produces({MediaType.TEXT_HTML})
    @Path("{corpus}/{document}/meta")
    public String documentMeta(
            @PathParam ("corpus") String corpus,
            @PathParam ("document") String document,
            @Context HttpServletRequest request,
            @Context HttpServletResponse response
    ) throws WebApplicationException {
        return documentMetadata(corpus, document, request, response).getOrThrow();
    }

    public Result<String, WebApplicationException> documentContents(
            String corpus,
            String document,
            String query,
            String pattgap,
            Optional<Integer> start,
            Optional<Integer> end,
            Optional<String> documentType,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        Result<String, ClientErrorException> content = new BlackLabApi(request, response).getDocumentContents(
                corpus,
                document,
                Optional.ofNullable(query),
                Optional.ofNullable(pattgap),
                start.filter(s -> s > 0), // when start = 0, remove it entirely (or blacklab will strip off content before the first token, i.e. headers etc).
                end.filter(e -> e > 0 && e > start.orElse(0))
        )
        // throw here if there's a problem getting document contents, so we don't bother parsing xslt if we don't have to
        // But first map the error into a regular webapp exception, so we can handle it in the same way as the other errors.
        .<ClientErrorException>throwIfError(e -> {
            if (e.getHttpStatusCode() == 401) return new NotAllowedException("Administrator has restricted access to this document.");
            else return new ClientErrorException("An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage(), e.getHttpStatusCode());
        });

        Result<XslTransformer, TransformerException> r = CorpusFileUtil.getStylesheet(
                config.get(Keys.FRONTEND_CONFIG_PATH),
                Optional.ofNullable(corpus),
                Optional.ofNullable(config.get(Keys.FRONTEND_CONFIG_PATH_DEFAULT)),
                "article",
                documentType,
                request,
                response
        )
        .or(defaultTransformer) // don't use recover() - we have to surface exceptions to the user (and recover() clears exceptions), or() doesn't.
        .map(trans -> {
            trans.addParameter("contextRoot", request.getServletContext().getContextPath());
            return trans;
        });

        return content.flatMapWithErrorHandling(c -> {
            if (!XML_TAG_PATTERN.matcher(c).find()) {
                return Result.success("<pre>" + StringUtils.replaceEach(c,
                        new String[] { "<hl>", "</hl>" },
                        new String[] { "<span class=\"hl\">", "</span>" }
                ) + "</pre>");
            }

            return r.mapWithErrorHandling(t -> t.transform(c));
        })
        .mapError(e -> new WebApplicationException(e, Status.INTERNAL_SERVER_ERROR));
    }

    public Result<String, WebApplicationException> documentMetadata(
            String corpus,
            String document,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return new BlackLabApi(request, response)
        .getDocumentMetadata(corpus, document)
        .<WebApplicationException>mapError(e -> {
            if (e.getHttpStatusCode() == 401) return new NotAllowedException("Administrator has restricted access to this document.");
            else return new ClientErrorException(e.getMessage(), e.getHttpStatusCode());
        })
        .flatMap(metadata ->
            CorpusFileUtil.getStylesheet(
                    config.get(Keys.FRONTEND_CONFIG_PATH),
                    Optional.ofNullable(corpus),
                    Optional.ofNullable(config.get(Keys.FRONTEND_CONFIG_PATH_DEFAULT)),
                    "meta",
                    Optional.empty(),
                    request,
                    response
            )
            .mapWithErrorHandling(trans -> {
                trans.addParameter("contextRoot", request.getServletContext().getContextPath());
                return trans;
            })
            .mapWithErrorHandling(trans -> trans.transform(metadata))
        )
        .mapError(e -> new WebApplicationException(e, Status.INTERNAL_SERVER_ERROR));
    }
}
