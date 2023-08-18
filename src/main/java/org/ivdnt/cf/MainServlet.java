/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package org.ivdnt.cf;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.function.Function;
import java.util.jar.Manifest;
import java.util.stream.Collectors;

import javax.xml.transform.TransformerException;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.velocity.Template;
import org.apache.velocity.app.Velocity;
import org.ivdnt.cf.GlobalConfig.Keys;
import org.ivdnt.cf.response.AboutResponse;
import org.ivdnt.cf.response.ArticleResponse;
import org.ivdnt.cf.response.ConfigResponse;
import org.ivdnt.cf.response.CorporaDataResponse;
import org.ivdnt.cf.response.CorporaResponse;
import org.ivdnt.cf.response.ErrorResponse;
import org.ivdnt.cf.response.HelpResponse;
import org.ivdnt.cf.response.RemoteIndexResponse;
import org.ivdnt.cf.response.SearchResponse;
import org.ivdnt.cf.utils.BlackLabApi;
import org.ivdnt.cf.utils.CorpusConfig;
import org.ivdnt.cf.utils.CorpusFileUtil;
import org.ivdnt.cf.utils.Result;
import org.ivdnt.cf.utils.ReturnToClientException;
import org.ivdnt.cf.utils.WebsiteConfig;
import org.ivdnt.cf.utils.XslTransformer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Main servlet class for the corpus application.
 * Reads the config, initializes stuff and dispatches requests.
 */
public class MainServlet extends HttpServlet {

    private static final Logger logger = LoggerFactory.getLogger(MainServlet.class);

    private static final String DEFAULT_PAGE = "corpora";

    /**
     * Where to find the Velocity properties file
     */
    private static final String VELOCITY_PROPERTIES = "/WEB-INF/config/velocity.properties";

    /**
     * Per-corpus configuration parameters (from search.xml)
     */
    private static final Map<String, WebsiteConfig> configs = new HashMap<>();

    /**
     * Our Velocity templates
     */
    private static final Map<String, Template> templates = new HashMap<>();

    /**
     * Xslt transformers for corpora
     */
    private static final Map<String, Result<XslTransformer, TransformerException>> articleTransformers = new HashMap<>();

    /**
     * The response classes for our URI patterns
     */
    private static final Map<String, Class<? extends BaseResponse>> responses = new HashMap<>();

    private GlobalConfig config;

    /**
     * Our context path (first part of our URI path)
     */
    private String contextPath;

    /**
     * Time the WAR was built. "UNKNOWN" if no WAR or some error occurs.
     */
    private static String warBuildTime = null;

    @Override
    public void init(ServletConfig cfg) throws ServletException {
        try {
            super.init(cfg);

            ServletContext ctx = cfg.getServletContext();
            this.contextPath = ctx.getContextPath();
            this.config = GlobalConfig.loadGlobalConfig(ctx);
            startVelocity(ctx);

            XslTransformer.setUseCache(this.useCache());
            BlackLabApi.setBlsUrl(config.get(Keys.PROP_BLS_SERVERSIDE));


            // Map responses, the majority of these can be served for a specific corpus, or as a general autosearch page
            // E.G. the AboutResponse is mapped to /<root>/<corpus>/about and /<root>/about
            responses.put(DEFAULT_PAGE, CorporaResponse.class);
            responses.put("about", AboutResponse.class);
            responses.put("help", HelpResponse.class);
            responses.put("search", SearchResponse.class);
            responses.put("docs", ArticleResponse.class);
            responses.put("static", CorporaDataResponse.class);
            responses.put("upload", RemoteIndexResponse.class);
            responses.put("config", ConfigResponse.class);
        } catch (ServletException e) {
            throw e;
        } catch (Exception e) {
            throw new ServletException(e);
        }
    }

    /**
     * Start the templating engine. Loading settings from {@link #VELOCITY_PROPERTIES}
     *
     * @param ctx configuration object
     * @throws IOException if the velocity config file could not be read
     */
    private void startVelocity(ServletContext ctx) throws IOException {
        // Read in the WebApplicationResourceLoader
        Velocity.setApplicationAttribute(ServletContext.class.getName(), ctx);

        Properties p = new Properties();
        try (InputStream is = getServletContext().getResourceAsStream(VELOCITY_PROPERTIES)) {
            p.load(is);
        }
        Velocity.init(p);
    }

    /**
     * Get the velocity template
     *
     * @param templateName name of the template, excluding filename (.vm) suffix
     * @return velocity template
     */
    public synchronized Template getTemplate(String templateName) {
        templateName = templateName + ".vm";

        if (Velocity.resourceExists(templateName)) {
            if (templates.containsKey(templateName)) {
                return templates.get(templateName);
            }

            try {
                Template t = Velocity.getTemplate(templateName, "utf-8");
                templates.put(templateName, t);
                return t;
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        // The template doesn't exist so we'll display an error page
        // it is important that the error template is available
        // or we'll end up in an infinite loop
        if (templateName.equals("error.vm")) {
            throw new RuntimeException("Could not find error template, giving up");
        }
        return getTemplate("error");
    }

    /**
     * Return the website config.
     *
     * @param corpus which corpus to read config for, may be null for the default config.
     * @return the website config
     */
    public synchronized WebsiteConfig getWebsiteConfig(Optional<String> corpus, HttpServletRequest request, HttpServletResponse response) {
        Function<String, WebsiteConfig> gen = __ ->
            getProjectFile(corpus, "search.xml")
            .map(configFile -> {
                try { return new WebsiteConfig(configFile, getCorpusConfig(corpus, request, response).getResult(), contextPath); }
                catch (ConfigurationException e) { throw new RuntimeException("Could not read search.xml " + configFile, e); }
            })
            .orElseThrow(() -> new IllegalStateException("No search.xml, and no default in jar either"));

        return useCache() ? configs.computeIfAbsent(corpus.orElse(null), gen) : gen.apply(corpus.orElse(null));
    }

    /**
     * Get the corpus config (as returned from blacklab-server), if this is a valid corpus
     *
     * @param corpus name of the corpus
     * @return the config
     */
    public Result<CorpusConfig, Exception> getCorpusConfig(Optional<String> corpus, HttpServletRequest request, HttpServletResponse response) {
        // Contact blacklab-server for the config xml file if we have a corpus
        // NOT CACHED ON PURPOSE: if blacklab has authentication, we need to re-authenticate every time
        return corpus.map(c -> new BlackLabApi(request, response).getCorpusConfig(c))
        .orElseGet(() -> Result.error(new FileNotFoundException("No corpus specified")));
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    public static Optional<Pair<String, String>> decodeBasicAuth(HttpServletRequest r) {
        String auth = r.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Basic ")) {
            return Optional.empty();
        }
        String[] userPass = new String(Base64.getDecoder().decode(auth.substring(6))).split(":", 2);
        if (userPass.length != 2) {
            return Optional.empty();
        }
        return Optional.of(Pair.of(userPass[0], userPass[1]));
    }

    private void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        try {
            request.setCharacterEncoding("utf-8");
        } catch (UnsupportedEncodingException ex) {
            logger.warn("Failed to set utf-8 encoding on request", ex);
        }

        /*
         * Map in the following way:
         * when the full uri contains at least 2 parts after the root (such as <root>/some_corpus/search)
         * treat the first of those parts as the corpus, the second as the response to send,
         * and everything after that as arguments to build the response.
         * When only one part is present (such as <root>/help) treat the first part as the response to send.
         * When nothing is present, serve the default page.
         *
         * This does mean that pages outside the context of a corpus cannot have arguments in the form of extra parts in the URI
         * For instance <root>/help/searching would try to serve the nonexistant "searching" response in the context of the corpus "help"
         */
        // First strip out any leading items like "/" and our root
        String requestUri = request.getRequestURI();
        if (requestUri.startsWith(contextPath)) {
            requestUri = requestUri.substring(contextPath.length());
        }

        // Use apache stringutils split as it's much more sensible about omitting leading/trailing and empty strings.
        List<String> pathParts = Arrays.stream(StringUtils.split(requestUri, '/'))
            .map(s -> URLDecoder.decode(s, StandardCharsets.UTF_8))
            .collect(Collectors.toList());

        String corpus = null;
        final String page;
        List<String> pathParameters = pathParts.subList(Math.min(pathParts.size(), 2), pathParts.size()); // remainder of the url after the context root and page url, split on '/' and decoded.
        if (pathParts.isEmpty()) { // requested application root
            page = DEFAULT_PAGE;
        } else if (pathParts.size() == 1) { // <page>
            page = pathParts.get(0);
        } else { // pathParts.size() >= 2 ... <corpus>/<page>/...
            corpus = pathParts.get(0);
            page = pathParts.get(1);
            if (corpus.equals(config.get(Keys.FRONTEND_CONFIG_PATH_DEFAULT)))
                corpus = null;
        }

        // Get response class
        Class<? extends BaseResponse> brClass = responses.getOrDefault(page, ErrorResponse.class);
        // If requesting invalid page, redirect to ${page}/search/, as the user probably meant to go to ${corpus}/search/ but instead went to ${corpus}/
        // if they actually meant a page, the corpus probably doesn't exist, they will still get a 404 as usual
        if (brClass.equals(ErrorResponse.class) && page != null && corpus == null) {
            logger.debug("Unknown raw page {} requested - might be a corpus, redirecting", page);
            response.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            response.setHeader("location", this.getServletContext().getContextPath() + "/" + page + "/search/");
            return;
        }

        // Instantiate response class
        BaseResponse br;
        try {
            br = brClass.getConstructor().newInstance();
        } catch (Exception e) {
            throw new ServletException(e);
        }

        if (br.isCorpusRequired() && (corpus == null || corpus.isEmpty())) {
            try {
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
            } catch (IOException e) {
                throw new ServletException(e);
            }

            return;
        }

        try {
            try {
                br.init(request, response, this, Optional.ofNullable(corpus), pathParameters);
                br.completeRequest();
            } catch (ReturnToClientException e) {
                if (e.getCode() != HttpServletResponse.SC_OK)
                    response.sendError(e.getCode(), e.getMessage());
                else if (e.getMessage() != null)
                    response.getWriter().write(e.getMessage());
            }
        } catch (IOException e) {
            throw new ServletException(e);
        }
    }

    /**
     * Get the stylesheet to convert a document or its metadata from this corpus into
     * an HTML snippet suitable for inserting in the article.vm page.
     *
     * First attempts to find file "${name}.xsl" in all locations, then,
     * as a fallback, attempts to find "${name}_${corpusDataFormat}.xsl" in all locations.
     * The data format suffix is supported to allow placing xsl files for all corpora in the same fallback directory.
     *
     * "meta.xsl" is used to transform the document's metadata, "article.xsl" for the content.
     * See {@link ArticleResponse}.
     *
     * Looks for a file by the name of "article_corpusDataFormat.xsl", so "article_tei" for tei, etc.
     * Separate xslt is used for metadata,
     *
     * <pre>
     * First tries retrieving the file using {@link #getProjectFile(Optional, String)}
     * If that fails, tries contacting blacklab-server for an autogenerated best-effort xsl file.
     *  - Note that this only returns something corpusDataFormat describes XML-based documents.
     * </pre>
     *
     * NOTE: We don't generate a generic fallback xslt here on purpose.
     * If we did, we'd have to inspect all documents we want to transform to see if they're actually XML,
     * since we'd return the default xslt even when blacklab returns 404 because the format isn't xml-based.
     * If we instead return empty optional when this happens, then we only need to inspect documents for which we can't get
     * a transformer, and can easily tell if they're xml documents or some other document/file type.
     *
     * @param name - the name of the file, excluding extension
     * @param corpusDataFormat - optional name suffix to differentiate files for different formats
     * @return the xsl transformer to use for transformation, note that this is always the same transformer.
     */
    public Result<XslTransformer, TransformerException> getStylesheet(Optional<String> corpus, String name, Optional<String> corpusDataFormat, HttpServletRequest request, HttpServletResponse response) {
        String dataDir = config.get(Keys.FRONTEND_CONFIG_PATH);
        Optional<String> fallbackCorpus = Optional.ofNullable(config.get(Keys.FRONTEND_CONFIG_PATH_DEFAULT)).filter(s -> !s.isEmpty());

        Function<String, Result<XslTransformer, TransformerException>> gen = __ -> CorpusFileUtil.getStylesheet(dataDir, corpus, fallbackCorpus, name, corpusDataFormat, request, response);

        // need to use corpus name in the cache map
        // because corpora can define their own xsl files in their own data directory
        String key = corpus + "_" + corpusDataFormat.orElse("missing-format") + "_" + name;
        return this.useCache() ? articleTransformers.computeIfAbsent(key, gen) : gen.apply(key);
    }

    public Optional<File> getProjectFile(Optional<String> corpus, String file) {
        return CorpusFileUtil.getProjectFile(
                config.get(Keys.FRONTEND_CONFIG_PATH),
                corpus,
                Optional.ofNullable(config.get(Keys.FRONTEND_CONFIG_PATH_DEFAULT)),
                Optional.of(file));
    }

    public InputStream getHelpPage(Optional<String> corpus) {
        return Result.from(getProjectFile(corpus, "help.inc"))
                .mapWithErrorHandling(FileInputStream::new)
                .getOrThrow(IllegalStateException::new); // this file always exists (at least the fallback in our own jar)
    }

    public InputStream getAboutPage(Optional<String> corpus) {
        return Result.from(getProjectFile(corpus, "about.inc"))
                .mapWithErrorHandling(FileInputStream::new)
                .getOrThrow(IllegalStateException::new); // this file always exists (at least the fallback in our own jar)
    }

    /** NOTE: never suffixed with corpus id, to unify behavior on different pages. The url will always end in "/" */
    public String getExternalWebserviceUrl() {
        String url = this.config.get(Keys.PROP_BLS_CLIENTSIDE);
        if (!url.endsWith("/")) {
            url += "/";
        }
        return url;
    }

    public Optional<String> getBannerMessage() {
        return Optional.ofNullable(StringUtils.trimToNull(this.config.get(Keys.PROP_BANNER_MESSAGE)));
    }

    public boolean useCache() {
        return Boolean.parseBoolean(this.config.get(Keys.PROP_CACHE));
    }

    /** Render debug info checkbox in the search interface? */
    public boolean debugInfo() {
        return Boolean.parseBoolean(this.config.get(Keys.FRONTEND_SHOW_DEBUG_CHECKBOX));
    }

    /**
     * Return a timestamp for when the application was built.
     *
     * @return build timestamp (format: yyyy-MM-dd HH:mm:ss), or UNKNOWN if the
     *         timestamp could not be found for some reason (i.e. not running from a
     *         JAR, or JAR was not created with the Ant buildscript).
     */
    public String getWarBuildTime() {
        if (warBuildTime != null)
            return warBuildTime;

        try (InputStream inputStream = getServletContext().getResourceAsStream("/META-INF/MANIFEST.MF")) {
            return warBuildTime = Optional.ofNullable(inputStream)
                .map(is -> {
                    try {
                        return new Manifest(is);
                    } catch (IOException e) {
                        return null;
                    }
                })
                .map(Manifest::getMainAttributes)
                .map(a -> a.getValue("Build-Time"))
                .filter(s -> !s.isEmpty())
                .orElse("UNKNOWN");
        } catch (IOException e) {
            return warBuildTime = "UNKNOWN";
        }
    }

    public GlobalConfig getGlobalConfig() {
        return config;
    }
}
