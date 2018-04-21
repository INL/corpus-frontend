/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.jar.Attributes;
import java.util.jar.Manifest;

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.TransformerConfigurationException;

import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang.SystemUtils;
import org.apache.log4j.Logger;
import org.apache.log4j.PropertyConfigurator;
import org.apache.velocity.Template;
import org.apache.velocity.app.Velocity;
import org.xml.sax.SAXException;

import nl.inl.corpuswebsite.response.AboutResponse;
import nl.inl.corpuswebsite.response.ArticleResponse;
import nl.inl.corpuswebsite.response.CorporaDataResponse;
import nl.inl.corpuswebsite.response.CorporaResponse;
import nl.inl.corpuswebsite.response.ErrorResponse;
import nl.inl.corpuswebsite.response.HelpResponse;
import nl.inl.corpuswebsite.response.SearchResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.QueryServiceHandler.QueryException;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 * Main servlet class for the corpus application.
 *
 * Reads the config, initializes stuff and dispatches requests.
 */
public class MainServlet extends HttpServlet {

    protected static final Logger logger = Logger.getLogger(MainServlet.class);

    private static final String DEFAULT_PAGE = "corpora";

    /**
     * Where to find the Velocity properties file
     */
    private static final String VELOCITY_PROPERTIES = "/WEB-INF/config/velocity.properties";

    /**
     * Where to find the Log4j properties file
     */
    private static final String LOG4J_PROPERTIES = "/WEB-INF/config/log4j.properties";

    /**
     * Per-corpus configuration parameters (from search.xml)
     */
    private Map<String, WebsiteConfig> configs = new HashMap<>();

    /**
     * Per-corpus structure and configuration gotten from blacklab-server
     */
    private Map<String, CorpusConfig> corpusConfigs = new HashMap<>();

    /**
     * Our Velocity templates
     */
    private Map<String, Template> templates = new HashMap<>();

    /**
     * The response classes for our URI patterns
     */
    private Map<String, Class<? extends BaseResponse>> responses = new HashMap<>();

    /**
     * Our context path (first part of our URI path)
     */
    private String contextPath;

    /** Word properties (like word, lemma, pos) that should be autocompleted by blacklab-server */
    public static final String PROP_AUTOCOMPLETE_PROPS     = "listvalues";
    public static final String PROP_ANALYTICS_KEY          = "googleAnalyticsKey";
    /** Url to reach blacklab-server from this application */
    public static final String PROP_BLS_CLIENTSIDE         = "blsUrlExternal";
    /** Url to reach blacklab-server from the browser */
    public static final String PROP_BLS_SERVERSIDE         = "blsUrl";
    /** Where static content, custom xslt and other per-corpus data is stored */
    public static final String PROP_DATA_PATH              = "corporaInterfaceDataDir";
    /** Name of the default 'corpus' if thhe datapath if not specified for the corpus */
    public static final String PROP_DATA_DEFAULT              = "corporaInterfaceDefault";
    /** Number of words displayed by default on the /article/ page, also is a hard limit on the number */
    public static final String PROP_DOCUMENT_PAGE_LENGTH   = "wordend";

    /**
     * Properties from the external config file, e.g. BLS URLs, Google Analytics
     * key, etc.
     * Several of these properties have defaults, take care to use getProperty() instead of direct get()
     */
    private Properties adminProps = new Properties();

    /**
     * Time the WAR was built.
     */
    private String warBuildTime = null;

    private static Properties getDefaultProps() {
        Properties p = new Properties();
        p.setProperty(PROP_AUTOCOMPLETE_PROPS,      "");
        p.setProperty(PROP_BLS_CLIENTSIDE,          "/blacklab-server"); // no domain to account for proxied servers
        p.setProperty(PROP_BLS_SERVERSIDE,          "http://localhost:8080/blacklab-server/");
        p.setProperty(PROP_DATA_PATH,               "/etc/blacklab/projectconfigs");
        p.setProperty(PROP_DATA_DEFAULT,            "default");
        p.setProperty(PROP_DOCUMENT_PAGE_LENGTH,    "5000");
        // not all properties may need defaults

        return p;
    }

    @Override
    public void init(ServletConfig cfg) throws ServletException {
        super.init(cfg);

        // initialise log4j
        try {
            Properties p = new Properties();
            p.load(getServletContext().getResourceAsStream(LOG4J_PROPERTIES));
            PropertyConfigurator.configure(p);
        } catch (IOException e1) {
            throw new ServletException(e1);
        }

        try {
            startVelocity(cfg);

            String warName = cfg.getServletContext().getContextPath().replaceAll("^/", "");
            contextPath = cfg.getServletContext().getContextPath();

            // Load the external properties file (for administration settings)
            String adminPropFileName = warName + ".properties";
            File adminPropFile = findPropertiesFile(adminPropFileName);
            adminProps = new Properties(getDefaultProps());

            if (adminPropFile == null || !adminPropFile.exists()) {
                logger.debug("File " + adminPropFileName + " (with blsUrl and blsUrlExternal settings) "
                        + "not found in webapps, /etc/blacklab/ or temp dir; will use defaults");
            } else if (!adminPropFile.isFile()) {
                throw new ServletException("Property file " + adminPropFile + " is not a regular file!");
            } else if (!adminPropFile.canRead()) {
                throw new ServletException("Property file " + adminPropFile + " exists but is unreadable!");
            } else {
                // File exists and can be read. Read it.
                logger.debug("Reading corpus-frontend property file: " + adminPropFile);
                try (Reader in = new BufferedReader(new FileReader(adminPropFile))) {
                    adminProps.load(in);
                }
            }

            Enumeration<?> propKeys = adminProps.propertyNames();
            while (propKeys.hasMoreElements()) {
                String key = (String) propKeys.nextElement();
                if (!adminProps.containsKey(key))
                    logger.debug("Property " + key + " not configured, using default: " + adminProps.getProperty(key));
            }
            if (!Paths.get(adminProps.getProperty(PROP_DATA_PATH)).isAbsolute()) {
                throw new ServletException(PROP_DATA_PATH + " setting should be an absolute path");
            }
        } catch (ServletException e) {
            throw e;
        } catch (Exception e) {
            throw new ServletException(e);
        }

        // Map responses, the majority of these can be served for a specific corpus, or as a general autosearch page
        // E.G. the AboutResponse is mapped to /<root>/<corpus>/about and /<root>/about
        responses.put(DEFAULT_PAGE, CorporaResponse.class);
        responses.put("about", AboutResponse.class);
        responses.put("help", HelpResponse.class);
        responses.put("search", SearchResponse.class);
        responses.put("article", ArticleResponse.class);
        responses.put("static", CorporaDataResponse.class);
    }

    /**
     * Looks for a property file with the specified name, either in the Tomcat
     * webapps dir, in /etc/blacklab on Unix or in the temp dir (/tmp on Unix,
     * %temp% on Windows).
     *
     * @param fileName property file name
     * @return the File or null if not found
     */
    private File findPropertiesFile(String fileName) {
        String warPath = getServletContext().getRealPath("/");
        if (warPath != null) {
            File fileInWebappsDir = new File(new File(warPath).getParentFile(), fileName);
            if (fileInWebappsDir.exists()) {
                return fileInWebappsDir;
            }
        } else {
            System.out.println("(WAR was not extracted to file system; skip looking for " + fileName + " file in webapps dir)");
        }

        boolean isWindows = SystemUtils.IS_OS_WINDOWS;
        File fileInEtc = new File("/etc/blacklab", fileName);
        if (!isWindows && !fileInEtc.exists()) {
            fileInEtc = new File("/vol1/etc/blacklab", fileName); // UGLY, will fix later
        }
        if (!isWindows && fileInEtc.exists()) {
            if (!fileInEtc.canRead()) {
                log("Found " + fileInEtc + " but cannot read; check permissions and SELinux context.");
            }
            return fileInEtc;
        }

        File tmpDir = isWindows ? new File(System.getProperty("java.io.tmpdir")) : new File("/tmp");
        File fileInTmpDir = new File(tmpDir, fileName);
        if (fileInTmpDir.exists()) {
            if (!fileInTmpDir.canRead()) {
                log("Found " + fileInTmpDir + " but cannot read; check permissions and SELinux context.");
            }
            return fileInTmpDir;
        }

        return null;
    }

    /**
     * Start the templating engine
     *
     * @param servletConfig configuration object
     * @throws Exception
     */
    private void startVelocity(ServletConfig servletConfig) throws Exception {
        Velocity.setApplicationAttribute("javax.servlet.ServletContext",
                servletConfig.getServletContext());

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
        return getTemplate("error");
    }

    /**
     * Return the website config.
     *
     * @param corpus which corpus to read config for, may be null for the
     * default config.
     * @return the website config
     */
    public WebsiteConfig getWebsiteConfig(String corpus) {
        if (!configs.containsKey(corpus)) {
            try (InputStream is = getProjectFile(corpus, "search.xml", true)) {
                configs.put(corpus, new WebsiteConfig(is, this.contextPath, corpus, getCorpusConfig(corpus)));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        return configs.get(corpus);
    }

    /**
     * Get the corpus config (as returned from blacklab-server)
     *
     * @param corpus name of the corpus
     * @return the config
     */
    public CorpusConfig getCorpusConfig(String corpus) {
        if (!corpusConfigs.containsKey(corpus)) {
            // Contact blacklab-server for the config xml file
            QueryServiceHandler handler = new QueryServiceHandler(getWebserviceUrl(corpus));

            String listvalues = adminProps.getProperty(PROP_AUTOCOMPLETE_PROPS);
            try {
                Map<String, String[]> params = new HashMap<>();

                params.put("outputformat", new String[]{"xml"});
                if (listvalues != null && !listvalues.isEmpty()) {
                    params.put("listvalues", new String[]{listvalues});
                }
                String userId = getCorpusOwner(corpus);
                if (userId != null)
                	params.put("userid", new String[] { userId });
                String xmlResult = handler.makeRequest(params);

                // TODO tidy this up, the json is only used to embed the index data in the search page.
                // We might not need the xml data to begin with.
                params.clear();
                params.put("outputformat", new String[]{"json"});
                if (userId != null)
                	params.put("userid", new String[] { userId });
                String jsonResult = handler.makeRequest(params);

                corpusConfigs.put(corpus, new CorpusConfig(xmlResult, jsonResult));
            } catch (IOException | SAXException | ParserConfigurationException | QueryException e) {
                throw new RuntimeException(e);
            }
        }

        return corpusConfigs.get(corpus);
    }

    @Override
    protected void doGet(HttpServletRequest request,
            HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request,
            HttpServletResponse response) throws ServletException {
        processRequest(request, response);
    }

    private void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException {

        try {
            request.setCharacterEncoding("utf-8");
        } catch (UnsupportedEncodingException ex) {
            logger.warn(ex.getMessage(), ex);
        }

        /*
		 * Map in the following way:
		 * when the full uri contains at least 2 parts after the root (such as <root>/zeebrieven/search)
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
        String[] pathParts = StringUtils.split(requestUri, "/");

        String corpus = null;
        String page = null;
        String remainder = null;
        if (pathParts.length == 0) { //
            page = DEFAULT_PAGE;
        } else if (pathParts.length == 1) { // <page>
            page = pathParts[0];
        } else if (pathParts.length >= 2) { // corpus>/<page>/...
            try {
                corpus = URLDecoder.decode(pathParts[0], StandardCharsets.UTF_8.name());
                page = pathParts[1];
                remainder = StringUtils.join(pathParts, "/", 2, pathParts.length);
            } catch (UnsupportedEncodingException e) {
                throw new RuntimeException(e);
            }
        }

        // Get response class
        Class<? extends BaseResponse> brClass = responses.getOrDefault(page, ErrorResponse.class);

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

        br.init(request, response, this, corpus, contextPath, remainder);
        br.completeRequest();
    }

    /**
     * Get a file from the directory belonging to this corpus and return it, or
     * return the default file if the corpus-specific file cannot be located.
     * If the corpus is null or the corpus is a user-uploaded corpus,or the file does not exist for this corpus,
     * try to load the project-default file.
     * If also the project-default file does not exist, or the interface data directory is not configured, the defaulft file is used.
     * This is provided the default file exists and
     * getDefaultIfMissing is true, otherwise null will be returned.
     *
     * @param corpus - corpus for which to get the file. If null, falls back to
     * the default files.
     * @param fileName - path to the file relative to the directory for the
     * corpus.
     * @param getDefaultIfMissing try to get the default file if the
     * corpus-specific file is missing?
     * @return the file, or null if not found
     */
    public final InputStream getProjectFile(String corpus, String fileName, boolean getDefaultIfMissing) {
        if (!adminProps.containsKey(PROP_DATA_PATH)) {
            logger.debug(PROP_DATA_PATH + " not set, couldn't find project file " + fileName + " for corpus " + corpus + (getDefaultIfMissing ? "; using default" : "; returning null"));
            return getDefaultIfMissing ? getDefaultProjectFile(fileName) : null;
        }

        InputStream fs = null;
        if(corpus != null && !isUserCorpus(corpus))
        	fs = getProjectFilestreamFromIFDir(corpus, fileName);
        if(fs == null) 
        	fs = getProjectFilestreamFromIFDir(adminProps.getProperty(PROP_DATA_DEFAULT), fileName);
        if(fs !=null)
        	return fs;
        
        return getDefaultIfMissing ? getDefaultProjectFile(fileName) : null;
    }

    /**
     * Wrapper around the getProjectFileFromIFDir method that tries reading the file into an Inputstream,
     *  and returns null on read exceptions.
     * @param corpus
     * @param fileName
     * @return
     */
	public final InputStream getProjectFilestreamFromIFDir(String corpus, String fileName) {
		File projectFile = null;
        try {
            projectFile = getProjectFileFromIFDir(corpus, fileName);
            if (projectFile!=null) {
                return new FileInputStream(projectFile);
            }

            // File path points outside the configured directory!
            logger.warn("File: " + fileName + " is null for corpus " + corpus );
        } catch (FileNotFoundException e) {
            throw new RuntimeException(fileName + " exists but still not found?", e);
        } catch (SecurityException e) {
            logger.debug("SecurityException finding project file " + fileName + " for corpus " + corpus + " as file " + projectFile.toString());
        }
        return null;
	}

    /**
     * return a file from the corporaInterfaceDataDir/corpus. Return null when file does not exist, cannot be read or is
     * outside of corporaInterfaceDataDir/corpus.
     * @param corpus
     * @param fileName
     * @return
     */
    public final File getProjectFileFromIFDir(String corpus, String fileName) {
        Path baseDir = Paths.get(adminProps.getProperty(PROP_DATA_PATH));
        Path corpusDir = baseDir.resolve(corpus).normalize();
        Path filePath = corpusDir.resolve(fileName).normalize();
        File projectFile = new File(filePath.toString());
        if (!projectFile.exists()) {
            // Problem with file permissions (possibly SELinux?)
            logger.warn("File " + projectFile + " does not exist!");
            return null;
        } else if (!projectFile.canRead()) {
            // Problem with file permissions (possibly SELinux?)
            logger.warn("File " + projectFile + " is unreadable!");
            return null;
        }
        if (corpusDir.startsWith(baseDir) && filePath.startsWith(corpusDir)) {
            return projectFile;
        } else {
            logger.warn("File " + projectFile + " outside of corporaInterfaceDataDir/"+corpus+"!");
            return null;
        }
    }

    /**
     * Get the stylesheet to convert an article from this corpus into an html
     * snippet suitable for inseting in the article.vm page.
     *
     * Resolves in 4 steps:
     * first see if we have a configured dataDir for this specific corpus, and attempt to retrieve the article_<corpusDataFormat> xsl from that directory.
     * If that fails, check if the file exists in the project default directory.
     * If that fails, see if an xsl file with that name exists in the provided WEB-INF/interface-default directory.
     * If that fails, contact blacklab-server for an autogenerated best-effort xsl file.
     * If that fails, return a default xsl file that just outputs all text.
     *
     * @param corpus
     * @param corpusDataFormat
     * @return the xsl transformer to use for transformation
     */
    public final XslTransformer getStylesheet(String corpus, String corpusDataFormat) {
        String fileName = "article_" + corpusDataFormat + ".xsl";

        File f = null;
        if (!isUserCorpus(corpus))
        	f = getProjectFileFromIFDir(corpus, fileName);
    	
        if(f==null)
        	f = getProjectFileFromIFDir(adminProps.getProperty(PROP_DATA_DEFAULT), fileName);
        
        if (f!=null) {
            try {
                return new XslTransformer(f);
            } catch (TransformerConfigurationException ex) {
                throw new RuntimeException(ex);
            }
        }
        // Get from explicitly defined xsl files for corpus or defaults.
        try (InputStream is = getProjectFile(corpus, fileName, true)) {
            if (is != null) {
                return new XslTransformer(is);
            }
        } catch (IOException | TransformerConfigurationException e) {
            log("Problem loading xsl file: " + fileName, e);
            // Don't bail yet, can still try to get from blacklab-server
        }

        XslTransformer stylesheet = null;
        // Still nothing, get an autogenned xsl from blacklab-server
        try {
            QueryServiceHandler handler = new QueryServiceHandler(getWebserviceUrl(null) + "input-formats/" + corpusDataFormat + "/xslt");
            Map<String, String[]> params = new HashMap<>();
            String userId = getCorpusOwner(corpus);
            if (userId != null)
            	params.put("userid", new String[] { userId });
            String sheet = handler.makeRequest(params);
            stylesheet = new XslTransformer(new StringReader(sheet));
        } catch (QueryException e) {
            if (e.getHttpStatusCode() == 404) {
                try {
                    // this might happen if the import format is deleted after a corpus was created.
                    // then blacklab-server can obviously no longer generate the xslt based on the import format.
                    stylesheet = new XslTransformer(new StringReader("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                            + "<xsl:stylesheet version=\"2.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">"
                            + "<xsl:output encoding=\"utf-8\" method=\"html\" omit-xml-declaration=\"yes\" />"
                            + "</xsl:stylesheet>"));
                } catch (TransformerConfigurationException ex) {
                    throw new RuntimeException(ex);
                }
            } else {
                throw new RuntimeException(e); // blacklab internal server error or the like, abort the request.
            }
        } catch (IOException | TransformerConfigurationException e) {
            throw new RuntimeException(e);
        }

        return stylesheet;
    }

    /**
     * Gets a file from the interface-default directory in the project.
     *
     * @param fileName The file to get. This should NOT start with "/"
     * @return the InputStream for the file. Or null if this file cannot be
     * found.
     */
    private InputStream getDefaultProjectFile(String fileName) {
        return getServletContext().getResourceAsStream("/WEB-INF/interface-default/" + fileName);
    }

    public InputStream getHelpPage(String corpus) {
        return getProjectFile(corpus, "help.inc", true);
    }

    public InputStream getAboutPage(String corpus) {
        return getProjectFile(corpus, "about.inc", true);
    }

    /**
     * Get the url to blacklab-server for this corpus. The url will always end
     * in "/"
     *
     * @param corpus the corpus for which to generate the url, if null, the base
     * blacklab-server url will be returned.
     * @return the url
     */
    public String getWebserviceUrl(String corpus) {
        String url = adminProps.getProperty(PROP_BLS_SERVERSIDE);
        if (!url.endsWith("/")) {
            url += "/";
        }

        if (corpus != null && !corpus.isEmpty()) {
            url += corpus + "/";
        }
        return url;
    }

    public String getExternalWebserviceUrl(String corpus) {
        String url = adminProps.getProperty(PROP_BLS_CLIENTSIDE);
        if (!url.endsWith("/")) {
            url += "/";
        }
        if (corpus != null && corpus.length() > 0) {
            url += corpus + "/";
        }
        return url;
    }

    public String getGoogleAnalyticsKey() {
        return adminProps.getProperty(PROP_ANALYTICS_KEY, "");
    }

    public int getWordsToShow() {
    	try {
    		return Integer.parseInt(adminProps.getProperty(PROP_DOCUMENT_PAGE_LENGTH));
    	} catch (NumberFormatException e) {
    		return 5000;
    	}
    }

    /**
     * Return a timestamp for when the application was built.
     *
     * @return build timestamp (format: yyyy-MM-dd HH:mm:ss), or UNKNOWN if the
     * timestamp could not be found for some reason (i.e. not running from a
     * JAR, or JAR was not created with the Ant buildscript).
     */
    public String getWarBuildTime() {
        if (warBuildTime == null) {
            try (InputStream inputStream = getServletContext().getResourceAsStream("/META-INF/MANIFEST.MF")) {
                if (inputStream == null) {
                    warBuildTime = "(no manifest)";
                } else {
                    try {
                        Manifest manifest = new Manifest(inputStream);
                        Attributes atts = manifest.getMainAttributes();
                        String value = null;
                        if (atts != null) {
                            value = atts.getValue("Build-Time");
                            if (value == null) {
                                value = atts.getValue("Build-Date"); // Old name for this info
                            }
                        }
                        warBuildTime = (value == null ? "UNKNOWN" : value);
                    } finally {
                        inputStream.close();
                    }
                }
            } catch (IOException e) {
                throw new RuntimeException("Could not read build date from manifest", e);
            }
        }
        return warBuildTime;
    }

    public Properties getAdminProps() {
        return adminProps;
    }

    public static boolean isUserCorpus(String corpus) {
        return corpus != null && corpus.indexOf(":") != -1;
    }

    public static String getCorpusName(String corpus) {
        if (corpus == null) {
            return null;
        }

        int i = corpus.indexOf(":");
        if (i != -1) {
            return corpus.substring(i + 1);
        }

        return corpus;
    }

    public static String getCorpusOwner(String corpus) {
        if (corpus == null) {
            return null;
        }

        int i = corpus.indexOf(":");
        if (i != -1) {
            return corpus.substring(0, i);
        }

        return null;
    }
}
