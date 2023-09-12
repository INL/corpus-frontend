package org.ivdnt.cf.rest.controllers;

import jakarta.annotation.Nullable;
import jakarta.servlet.ServletContext;
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
import org.springframework.web.bind.annotation.*;

import javax.xml.transform.TransformerException;
import java.io.StringReader;
import java.util.Optional;
import java.util.regex.Pattern;

@Controller("xslt") // this is just the name of the controller, not the path (it can be used to generate links to this controller without having to hardcode the path)
@RequestMapping("/api/xslt") // whereas this is the path
@ResponseBody // map return objects from our methods to the body of the response, instead of trying to resolve them to a view template file
public class XsltController {

    final GlobalConfigProperties config;
    final String contextPath;

    /** Default transformer that translates <hl> tags into highlighted spans and outputs all text */
    private static final XslTransformer defaultTransformer;

    /** Matches xml open/void tags &lt;namespace:tagname attribute="value"/&gt; excluding hl tags, as those are inserted by blacklab and can result in false positives */
    private static final Pattern XML_TAG_PATTERN = Pattern.compile("<([\\w]+:)?((?!(hl|blacklabResponse|[xX][mM][lL])\\b)[\\w.]+)(\\s+[\\w\\.]+=\"[\\w\\s,]*\")*\\/?>");

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
    public XsltController(GlobalConfigProperties config, ServletContext servletContext) {
        this.config = config;
        this.contextPath = servletContext.getContextPath();
    }

    @GetMapping(path="/{corpus}/{document}/content", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentContents(
            @PathVariable("corpus") String corpus,
            @PathVariable ("document") String document,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) @Nullable String pattgap,
            @RequestParam(value = "type", required = false) @Nullable String documentType,
            BlackLabApi api
    ) {
        return documentContents(corpus, document, query, pattgap, Optional.empty(), Optional.empty(), Optional.ofNullable(documentType), api).getOrThrow();
    }

    @GetMapping(path="/{corpus}/{document}/content", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentContentsXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            BlackLabApi api
    ) {
        return new GenericXmlJsonResult(documentContents(corpus, document, query, pattgap, documentType, api));
    }

    @GetMapping(path="/{corpus}/{document}/content/{start}-{end}", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentContentsHtml(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @PathVariable ("start") int start,
            @PathVariable ("end") int end,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            BlackLabApi api
    ) {
        return documentContents(corpus, document, query, pattgap, Optional.of(start), Optional.of(end), Optional.ofNullable(documentType), api).getOrThrow();
    }

    @GetMapping(path="/{corpus}/{document}/content/{start}-{end}", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentContentsXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            @PathVariable ("start") int start,
            @PathVariable ("end") int end,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "pattgapdata", required = false) String pattgap,
            @RequestParam(value = "type", required = false) String documentType,
            BlackLabApi api
    ) {
        return new GenericXmlJsonResult(
                documentContentsHtml(corpus, document, start, end, query, pattgap, documentType, api));
    }

    @GetMapping(path="/{corpus}/{document}/meta", produces = { MediaType.TEXT_HTML_VALUE, MediaType.TEXT_PLAIN_VALUE })
    public String documentMeta(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            BlackLabApi api
    ) {
        return documentMetadata(corpus, document, api).getOrThrow();
    }

    @GetMapping(path="/{corpus}/{document}/meta", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE })
    public GenericXmlJsonResult documentMetaXmlJson(
            @PathVariable ("corpus") String corpus,
            @PathVariable ("document") String document,
            BlackLabApi api
    ) {
        return new GenericXmlJsonResult(documentMetadata(corpus, document, api).getOrThrow());
    }

    public Result<String, CFApiException> documentContents(
            String corpus,
            String document,
            String query,
            String pattgap,
            Optional<Integer> start,
            Optional<Integer> end,
            Optional<String> documentType,
            BlackLabApi api
    ) {
        Result<String, CFApiException> content = api.getDocumentContents(
                corpus,
                document,
                Optional.ofNullable(query),
                Optional.ofNullable(pattgap),
                start.filter(s -> s > 0), // when start = 0, remove it entirely (or blacklab will strip off content before the first token, i.e. headers etc).
                end.filter(e -> e > 0 && e > start.orElse(0))
        )
        // throw here if there's a problem getting document contents, so we don't bother parsing xslt if we don't have to
        // But first map the message to something more user-friendly.
        .throwIfError(e -> {
            if (e.getCode().equals(HttpStatus.FORBIDDEN) || e.getCode().equals(HttpStatus.UNAUTHORIZED) || e.getCode().equals(HttpStatus.UNAVAILABLE_FOR_LEGAL_REASONS))
                return new CFApiException(HttpStatus.UNAUTHORIZED, "Administrator has restricted access to this document.");
            else
                return new CFApiException(e.getCode(), "An error occurred while retrieving document contents from BlackLab: \n" + e.getMessage());
        });

        // Load the stylesheet from disk
        Result<XslTransformer, TransformerException> r = CorpusFileUtil.getStylesheet(
                config.getCorporaInterfaceDataDir(),
                Optional.ofNullable(corpus),
                Optional.ofNullable(config.getCorporaInterfaceDefault()),
                "article",
                documentType
        )
        // No stylesheet from disk? If we know the documentType, we can try to get a default from BlackLab
        .or(() -> Result
                .from(documentType) // only continue if documentType is set.
                .flatMap(api::getStylesheet)
                .mapWithErrorHandling(XslTransformer::new)
                .mapError(e -> new TransformerException(
                        "Error parsing xsl from blacklab-server.\n" +
                        (e instanceof TransformerException ? ((TransformerException) e).getMessageAndLocation() : e.getMessage())
                ))
        )
        // Nothing from BlackLab either? Use the default transformer
        .or(defaultTransformer) // don't use recover() - we have to surface exceptions to the user (and recover() clears exceptions), or() doesn't.
        .tap(trans -> trans.addParameter("contextPath", contextPath));

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
            BlackLabApi api
    ) {
        return api
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
                    Optional.empty()
            )
            .tap(trans -> trans.addParameter("contextRoot", contextPath))
            .mapWithErrorHandling(trans -> trans.transform(metadata))
        )
        .mapError(CFApiException::wrap);
    }
}
