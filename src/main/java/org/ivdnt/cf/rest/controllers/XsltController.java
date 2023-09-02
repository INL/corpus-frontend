package org.ivdnt.cf.rest.controllers;

import java.io.StringReader;
import java.util.Optional;
import java.util.regex.Pattern;

import javax.xml.transform.TransformerException;

import org.apache.commons.lang3.StringUtils;
import org.ivdnt.cf.CFApiException;
import org.ivdnt.cf.GlobalConfigProperties;
import org.ivdnt.cf.rest.pojo.GenericXmlJsonResult;
import org.ivdnt.cf.utils2.BlackLabApi;
import org.ivdnt.cf.utils2.CorpusFileUtil;
import org.ivdnt.cf.utils2.Result;
import org.ivdnt.cf.utils2.XslTransformer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.annotation.Nullable;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Controller("xslt") // this is just the name of the controller, not the path (it can be used to generate links to this controller without having to hardcode the path)
@RequestMapping("/xslt") // whereas this is the path
@ResponseBody // map return objects from our methods to the body of the response, instead of trying to resolve them to a view template file
public class XsltController {

    final GlobalConfigProperties config;

    /** Default transformer that translates <hl> tags into highlighted spans and outputs all text */
    private static final XslTransformer defaultTransformer;

    /** Matches xml open/void tags &lt;namespace:tagname attribute="value"/&gt; excluding hl tags, as those are inserted by blacklab and can result in false positives */
private static final Pattern XML_TAG_PATTERN = Pattern.compile("<([\\w]+:)?((?!(hl|blacklabResponse|[xX][mM][lL])\\b)[\\w.]+)(\\s+[\\w\\.]+=\"[\\w\\s,]*\")*\\/?>");

//    private static final Pattern CAPTURE_DOCLENGTH_PATTERN = Pattern.compile("<lengthInTokens>\\s*(\\d+)\\s*<\\/lengthInTokens>");

    static {
        try {
            defaultTransformer = new XslTransformer("DEFAULTTRANSFORMER",new StringReader(
"""
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
    <xsl:template match="text()">
        <xsl:value-of select="replace(., '[&#x007F;-&#x009F;]', ' ')"/>
    </xsl:template>
    <xsl:template match="*[local-name(.)='hl']">
        <span class="hl">
            <xsl:apply-templates select="node()"/>
        </span>
    </xsl:template>
</xsl:stylesheet>
"""));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }


    @Autowired
    public XsltController(GlobalConfigProperties config) {
        this.config = config;
        // TODO: do this the spring way or something.
        BlackLabApi.setBlsUrl(config.getBlsUrl());
    }


//    @GET
//    @Produces({MediaType.TEXT_HTML, MediaType.TEXT_PLAIN}) // the generated html is not valid xml, so don't return it as such (multiple root elements etc)
//    @Path("{corpus}/{document}/content")
    @GetMapping(path="/{corpus}/{document}/content", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentContents(
            @PathVariable("corpus") String corpus,
            @PathVariable ("document") String document,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) @Nullable String pattgap,
            @RequestParam(value = "type", required = false) @Nullable String documentType,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return documentContents(corpus, document, query, pattgap, Optional.empty(), Optional.empty(), Optional.ofNullable(documentType), request, response).getOrThrow();
    }

//    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML, MediaType.TEXT_XML})
//    @Path("{corpus}/{document}/content")
    @GetMapping(path="/{corpus}/{document}/content", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentContentsXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return new GenericXmlJsonResult(documentContents(corpus, document, query, pattgap, documentType, request, response));
    }

//    @GET
//    @Produces({MediaType.TEXT_HTML, MediaType.TEXT_PLAIN}) // the generated html is not valid xml, so don't return it as such (multiple root elements etc)
//    @Path("{corpus}/{document}/content/{start}-{end}")
    @GetMapping(path="/{corpus}/{document}/content/{start}-{end}", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentContentsHtml(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @PathVariable ("start") int start,
            @PathVariable ("end") int end,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return documentContents(corpus, document, query, pattgap, Optional.of(start), Optional.of(end), Optional.ofNullable(documentType), request, response).getOrThrow();
    }

//    @GET
//    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML, MediaType.TEXT_XML})
//    @Path("{corpus}/{document}/content/{start}-{end}")
    @GetMapping(path="/{corpus}/{document}/content/{start}-{end}", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentContentsXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @PathVariable ("start") int start,
            @PathVariable ("end") int end,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return new GenericXmlJsonResult(
                documentContentsHtml(corpus, document, start, end, query, pattgap, documentType, request, response));
    }

    @GetMapping(path="/{corpus}/{document}/meta", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentMeta(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return documentMetadata(corpus, document, request, response).getOrThrow();
    }

    @GetMapping(path="/{corpus}/{document}/meta", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentMetaXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return new GenericXmlJsonResult(documentMetadata(corpus, document, request, response).getOrThrow());
    }

    public Result<String, CFApiException> documentContents(
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
        Result<String, CFApiException> content = new BlackLabApi(request, response).getDocumentContents(
                corpus,
                document,
                Optional.ofNullable(query),
                Optional.ofNullable(pattgap),
                start.filter(s -> s > 0), // when start = 0, remove it entirely (or blacklab will strip off content before the first token, i.e. headers etc).
                end.filter(e -> e > 0 && e > start.orElse(0))
        )
        // throw here if there's a problem getting document contents, so we don't bother parsing xslt if we don't have to
        // But first map the message to something more user-friendly.
        .<CFApiException>throwIfError(e -> {
            if (e.getCode().equals(HttpStatus.FORBIDDEN) || e.getCode().equals(HttpStatus.UNAUTHORIZED) || e.getCode().equals(HttpStatus.UNAVAILABLE_FOR_LEGAL_REASONS))
                return new CFApiException(HttpStatus.UNAUTHORIZED, "Administrator has restricted access to this document.");
            else
                return new CFApiException(e.getCode(), "An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage());
        });

        Result<XslTransformer, TransformerException> r = CorpusFileUtil.getStylesheet(
                config.getCorporaInterfaceDataDir(),
                Optional.ofNullable(corpus),
                Optional.ofNullable(config.getCorporaInterfaceDefault()),
                "article",
                documentType,
                request,
                response
        )
        .or(defaultTransformer) // don't use recover() - we have to surface exceptions to the user (and recover() clears exceptions), or() doesn't.
        .tap(trans -> trans.addParameter("contextRoot", request.getServletContext().getContextPath()));

        return content.flatMapWithErrorHandling(c -> {
            if (!XML_TAG_PATTERN.matcher(c).find()) {
                return Result.success("<pre>" + StringUtils.replaceEach(c,
                        new String[] { "<hl>", "</hl>" },
                        new String[] { "<span class=\"hl\">", "</span>" }
                ) + "</pre>");
            }

            return r.mapWithErrorHandling(t -> t.transform(c));
        })
        .mapError(CFApiException::wrap);
    }

    public Result<String, CFApiException> documentMetadata(
            String corpus,
            String document,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return new BlackLabApi(request, response)
        .getDocumentMetadata(corpus, document)
        .<CFApiException>mapError(e -> {
            if (e.getCode().equals(HttpStatus.FORBIDDEN) || e.getCode().equals(HttpStatus.UNAUTHORIZED) || e.getCode().equals(HttpStatus.UNAVAILABLE_FOR_LEGAL_REASONS))
                return new CFApiException(HttpStatus.UNAUTHORIZED, "Administrator has restricted access to this document.");
            else
                return new CFApiException(e.getCode(), "An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage());
        })
        .flatMap(metadata ->
            CorpusFileUtil.getStylesheet(
                    config.getCorporaInterfaceDataDir(),
                    Optional.ofNullable(corpus),
                    Optional.ofNullable(config.getCorporaInterfaceDefault()),
                    "meta",
                    Optional.empty(),
                    request,
                    response
            )
            .tap(trans -> trans.addParameter("contextRoot", request.getServletContext().getContextPath()))
            .mapWithErrorHandling(trans -> trans.transform(metadata))
        )
        .mapError(CFApiException::wrap);
    }
}
