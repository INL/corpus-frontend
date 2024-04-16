/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

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
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.velocity.Template;
import org.apache.velocity.app.Velocity;

import nl.inl.corpuswebsite.response.AboutResponse;
import nl.inl.corpuswebsite.response.ApiResponse;
import nl.inl.corpuswebsite.response.ArticleResponse;
import nl.inl.corpuswebsite.response.ConfigResponse;
import nl.inl.corpuswebsite.response.ConfigWizardResponse;
import nl.inl.corpuswebsite.response.CorporaDataResponse;
import nl.inl.corpuswebsite.response.CorporaResponse;
import nl.inl.corpuswebsite.response.ErrorResponse;
import nl.inl.corpuswebsite.response.HelpResponse;
import nl.inl.corpuswebsite.response.OidcCallbackResponse;
import nl.inl.corpuswebsite.response.RemoteIndexResponse;
import nl.inl.corpuswebsite.response.SearchResponse;
import nl.inl.corpuswebsite.utils.BlackLabApi;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.CorpusFileUtil;
import nl.inl.corpuswebsite.utils.GlobalConfig;
import nl.inl.corpuswebsite.utils.GlobalConfig.Keys;
import nl.inl.corpuswebsite.utils.QueryException;
import nl.inl.corpuswebsite.utils.Result;
import nl.inl.corpuswebsite.utils.ReturnToClientException;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 * Main servlet class for the corpus application.
 * Reads the config, initializes stuff and dispatches requests.
 */
public class MainServlet extends HttpServlet {

    private static final Logger logger = Logger.getLogger(MainServlet.class.getName());

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

    @Override
    public void init(ServletConfig cfg) throws ServletException {
        try {
            super.init(cfg);

            ServletContext ctx = cfg.getServletContext();
            this.config = GlobalConfig.loadGlobalConfig(ctx);
            startVelocity(ctx);

            XslTransformer.setUseCache(this.useCache(null));
            BlackLabApi.setBlsUrl(config.get(Keys.BLS_URL_ON_SERVER));

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
            responses.put("configwizard", ConfigWizardResponse.class);
            responses.put("api", ApiResponse.class);
            responses.put("callback", OidcCallbackResponse.class);
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

        // The template doesn't exist, so we'll display an error page
        // it is important that the error template is available,
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
    public synchronized WebsiteConfig getWebsiteConfig(Optional<String> corpus) {
        Function<String, WebsiteConfig> gen = __ ->
            getProjectFile(corpus, "search.xml")
            .map(configFile -> {
                try { return new WebsiteConfig(configFile, config.get(Keys.CF_URL_ON_CLIENT), corpus); }
                catch (ConfigurationException e) { throw new RuntimeException("Could not read search.xml " + configFile, e); }
            })
            .orElseThrow(() -> new IllegalStateException("No search.xml, and no default in jar either"));

        return useCache(null) ? configs.computeIfAbsent(corpus.orElse(null), gen) : gen.apply(corpus.orElse(null));
    }

    // TODO use network-level caching or something, so we automatically handle lifetime, authentication, etc.
    private static final Map<String, Result<CorpusConfig, Exception>> configCache = new HashMap<>();
    /**
     * Get the corpus config (as returned from blacklab-server), if this is a valid corpus
     *
     * @param corpus name of the corpus
     * @return the config
     */
    public Result<CorpusConfig, Exception> getCorpusConfig(Optional<String> corpus, HttpServletRequest request, HttpServletResponse response) {
        // Should only cache when not using authorization, otherwise result may be different across different requests.
        // Also disable caching for user-corpora, as access permissions may change.

        // Contact blacklab-server for the config xml file if we have a corpus
        Function<String, Result<CorpusConfig, Exception>> gen = c -> new BlackLabApi(request, response, this.config).getCorpusConfig(c);
        return Result
                .from(corpus)
                .flatMap(c -> useCache(request) ? configCache.computeIfAbsent(c, gen) : gen.apply(c))
                .orError(() -> new FileNotFoundException("No corpus specified"));
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    private void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        try {
            request.setCharacterEncoding("utf-8");
        } catch (UnsupportedEncodingException ex) {
            logger.log(Level.WARNING, "Failed to set utf-8 encoding on request", ex);
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
        // (use the actual contextpath here, since we're already behind any proxy.
        String requestUri = StringUtils.substringAfter(request.getRequestURI(), request.getContextPath());

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
            if (corpus.equals(config.get(Keys.DEFAULT_CORPUS_CONFIG)))
                corpus = null;
        }

        // Get response class
        Class<? extends BaseResponse> brClass = responses.getOrDefault(page, ErrorResponse.class);
        // If requesting invalid page, redirect to ${page}/search/, as the user probably meant to go to ${corpus}/search/ but instead went to ${corpus}/
        // if they actually meant a page, the corpus probably doesn't exist, they will still get a 404 as usual
        if (brClass.equals(ErrorResponse.class) && page != null && corpus == null) {
            logger.fine(String.format("Unknown page '%s' requested - might be a corpus, redirecting to search page", page));
            response.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            response.setHeader("location", this.config.get(Keys.CF_URL_ON_CLIENT) + "/" + page + "/search/");
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
            } catch (QueryException e ) {
                if (e.getHttpStatusCode() != HttpServletResponse.SC_OK) {
                    response.sendError(e.getHttpStatusCode(), e.getMessage());
                } else {
                    response.getWriter().write(e.getMessage());
              }
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
     * <pre>
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
     * First tries retrieving the file using {@link #getProjectFile(Optional, String)}
     * If that fails, tries contacting blacklab-server for an autogenerated best-effort xsl file.
     *  - Note that this only returns something corpusDataFormat describes XML-based documents.
     *
     * NOTE: We don't generate a generic fallback xslt here on purpose.
     * If we did, we'd have to inspect all documents we want to transform to see if they're actually XML,
     * since we'd return the default xslt even when blacklab returns 404 because the format isn't xml-based.
     * If we instead return empty optional when this happens, then we only need to inspect documents for which we can't get
     * a transformer, and can easily tell if they're xml documents or some other document/file type.
     * </pre>
     * @param name - the name of the file, excluding extension
     * @param corpusDataFormat - optional name suffix to differentiate files for different formats
     * @return the xsl transformer to use for transformation, note that this is always the same transformer.
     */
    public Result<XslTransformer, TransformerException> getStylesheet(Optional<String> corpus, String name, Optional<String> corpusDataFormat, HttpServletRequest request, HttpServletResponse response) {
        String dataDir = config.get(Keys.CORPUS_CONFIG_DIR);
        Optional<String> fallbackCorpus = Optional.ofNullable(config.get(Keys.DEFAULT_CORPUS_CONFIG)).filter(s -> !s.isEmpty());

        Function<String, Result<XslTransformer, TransformerException>> gen = __ -> CorpusFileUtil.getStylesheet(dataDir, corpus, fallbackCorpus, name, corpusDataFormat, request, response, this.config);

        // need to use corpus name in the cache map
        // because corpora can define their own xsl files in their own data directory
        String key = corpus + "_" + corpusDataFormat.orElse("missing-format") + "_" + name;
        return this.useCache(request) ? articleTransformers.computeIfAbsent(key, gen) : gen.apply(key);
    }

    public Optional<File> getProjectFile(Optional<String> corpus, String file) {
        return CorpusFileUtil.getProjectFile(
                config.get(Keys.CORPUS_CONFIG_DIR),
                corpus,
                Optional.ofNullable(config.get(Keys.DEFAULT_CORPUS_CONFIG)),
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

    /**
     * Check whether caching of things is enabled.
     * @param request if supplied, check if the request contains authentication parameters (according to AUTH_SOURCE_NAME and AUTH_SOURCE_TYPE), and return false if it does.
     *                If not supplied, check if the global config allows caching.
     * @return whether the use the cache for this request
     */
    public boolean useCache(HttpServletRequest request) {
        Optional<String> auth = Optional.ofNullable(request).flatMap(r -> BlackLabApi.readRequestParameter(r, config.get(Keys.AUTH_SOURCE_TYPE), config.get(Keys.AUTH_SOURCE_NAME)));
        return Boolean.parseBoolean(this.config.get(Keys.CACHE)) && auth.isEmpty();
    }

    /** Render debug info checkbox in the search interface? */
    public boolean debugInfo() {
        return Boolean.parseBoolean(this.config.get(Keys.SHOW_DEBUG_CHECKBOX_ON_CLIENT));
    }

    public GlobalConfig getGlobalConfig() {
        return config;
    }
}
