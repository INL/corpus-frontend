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
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
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

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang.SystemUtils;
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
import nl.inl.corpuswebsite.utils.WebsiteConfig;

/**
 * Main servlet class for the corpus application.
 *
 * Reads the config, initializes stuff and dispatches requests.
 */
public class MainServlet extends HttpServlet {

	private static final boolean DEBUG = true;

	private static final String DEFAULT_PAGE = "corpora";

	/** Where to find the Velocity properties file */
	private final String VELOCITY_PROPERTIES = "/WEB-INF/config/velocity.properties";

	/** Where to find the Log4j properties file */
	private final String LOG4J_PROPERTIES = "/WEB-INF/config/log4j.properties";

	/** Our configuration parameters (from search.xml) */
	private Map<String, WebsiteConfig> configs = new HashMap<>();

	/** Our configuration parameters gotten from blacklab-server */
	private Map<String, CorpusConfig> corpusConfigs = new HashMap<>();

	/** Our Velocity templates */
	private Map<String, Template> templates = new HashMap<>();

	/** The response classes for our URI patterns */
	private Map<String, Class<? extends BaseResponse>> responses = new HashMap<>();

	/** Our context path (first part of our URI path) */
	private String contextPath;

	/** Properties from the external config file, e.g. BLS URLs, Google Analytics key, etc. */
	private Properties adminProps;

	/** Our cached XSL stylesheets */
	private Map<String, String> stylesheets = new HashMap<>();

	/**
	 * Time the WAR was built.
	 */
	private String warBuildTime = null;

	@Override
	public void init(ServletConfig cfg) throws ServletException {
		super.init(cfg);

		// initialise log4j
		Properties p = new Properties();
		try {
			p.load(getServletContext().getResourceAsStream(LOG4J_PROPERTIES));
			PropertyConfigurator.configure(p);
		} catch (IOException e1) {
			throw new RuntimeException(e1);
		}

		try {
			startVelocity(cfg);

			String warName = cfg.getServletContext().getContextPath().replaceAll("^/", ""); //warExtractDir.getName();
			contextPath = cfg.getServletContext().getContextPath();

			// Load the external properties file (for administration settings)
			String adminPropFileName = warName + ".properties";
			File adminPropFile = findPropertiesFile(adminPropFileName);
			if (adminPropFile == null)
				throw new ServletException(
						"File "
								+ adminPropFileName
								+ " (with blsUrl and blsUrlExternal settings) not found in webapps or temp dir!");
			if (!adminPropFile.isFile()) {
				throw new RuntimeException("Property file " + adminPropFile + " does not exist or is not a regular file!");
			}
			adminProps = new Properties();
			try (Reader in = new BufferedReader(new FileReader(adminPropFile))) {
				adminProps.load(in);
			}
			debugLog("Admin prop file: " + adminPropFile);
			if (!adminProps.containsKey("blsUrl"))
				throw new ServletException("Missing blsUrl setting in "
						+ adminPropFile);
			if (!adminProps.containsKey("blsUrlExternal"))
				throw new ServletException("Missing blsUrlExternal setting in "
						+ adminPropFile);
			if (!adminProps.containsKey("corporaInterfaceDataDir")) {
				debugLog("Missing corporaInterfaceDataDir setting in " + adminPropFileName);
				debugLog("Per-corpus data (such as icons, colors, backgrounds, images) will not be available!");
			} else if (!Paths.get(adminProps.getProperty("corporaInterfaceDataDir")).isAbsolute()) {
				throw new ServletException("corporaInterfaceDataDir should be an absolute path");
			}

			debugLog("blsUrl: " + adminProps.getProperty("blsUrl"));
			debugLog("blsUrlExternal: " + adminProps.getProperty("blsUrlExternal"));
			if (adminProps.containsKey("corporaInterfaceDataDir"))
				debugLog("corporaInterfaceDataDir: " + adminProps.getProperty("corporaInterfaceDataDir"));

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
		responses.put("error", ErrorResponse.class);
	}

	private static void debugLog(String msg) {
		if (DEBUG)
			System.out.println(msg);
	}

	/**
	 * Looks for a property file with the specified name, either in the Tomcat
	 * webapps dir, in /etc/blacklab on Unix or in the temp dir (/tmp on Unix,
	 * %temp% on Windows).
	 *
	 * @param fileName
	 *            property file name
	 * @return the File or null if not found
	 */
	private File findPropertiesFile(String fileName) {
		String warPath = getServletContext().getRealPath("/");
		if (warPath != null) {
			File fileInWebappsDir = new File(new File(warPath).getParentFile(), fileName);
			if (fileInWebappsDir.exists())
				return fileInWebappsDir;
		} else {
			System.out.println("(WAR was not extracted to file system; skip looking for " + fileName + " file in webapps dir)");
		}

		boolean isWindows = SystemUtils.IS_OS_WINDOWS;
		File fileInEtc = new File("/etc/blacklab", fileName);
		if (!isWindows && !fileInEtc.exists())
			fileInEtc = new File("/vol1/etc/blacklab", fileName); // UGLY, will fix later
		if (!isWindows && fileInEtc.exists())
			return fileInEtc;

		File tmpDir = isWindows ? new File(System.getProperty("java.io.tmpdir")) : new File("/tmp");
		File fileInTmpDir = new File(tmpDir, fileName);
		if (fileInTmpDir.exists())
			return fileInTmpDir;

		return null;
	}

	/**
	 * Start the templating engine
	 *
	 * @param servletConfig
	 *            configuration object
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
	 * @param templateName
	 *            name of the template
	 * @return velocity template
	 */
	public synchronized Template getTemplate(String templateName) {
		templateName = templateName + ".vm";

		// if the template exists
		if (Velocity.resourceExists(templateName)) {
			// if the template was already loaded
			if (templates.containsKey(templateName)) {
				return templates.get(templateName);
			}

			// template wasn't loaded yet - try to load it now
			try {
				// load the template
				Template t = Velocity.getTemplate(templateName, "utf-8");
				// store it
				templates.put(templateName, t);
				return t;
			} catch (Exception e) {
				// Something went wrong, we die
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
	 * @param corpus which corpus to read config for, may be null for the default config.
	 * @return the website config
	 */
	public WebsiteConfig getWebsiteConfig(String corpus) {
		if (!configs.containsKey(corpus)) {
			try (InputStream is = getProjectFile(corpus, "search.xml", true)) {
				configs.put(corpus, new WebsiteConfig(is, this.contextPath, corpus));
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


			try {
				Map<String, String[]> params = new HashMap<>();

				params.put("outputformat", new String[] {"xml"});
				String xmlResult = handler.makeRequest(params);

				params.put("outputformat", new String[] {"json"});
				String jsonResult = handler.makeRequest(params);

				corpusConfigs.put(corpus, new CorpusConfig(xmlResult, jsonResult));
			} catch (IOException | SAXException | ParserConfigurationException e) {
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
		if (pathParts.length == 0) //
			page = DEFAULT_PAGE;
		else if (pathParts.length == 1) // <page>
			page = pathParts[0];
		else if (pathParts.length >= 2) { // corpus>/<page>/...
			try {
				corpus = URLDecoder.decode(pathParts[0], StandardCharsets.UTF_8.name());
				page = pathParts[1];
				remainder = StringUtils.join(pathParts, "/", 2, pathParts.length);
			} catch (UnsupportedEncodingException e) {
				throw new RuntimeException(e);
			}
		}



		// Get response class
		Class<? extends BaseResponse> brClass = responses.get(page);
		if (brClass == null)
			brClass = responses.get("error");

		// TODO better error handling.
		if (corpus != null) {
			try {
				getCorpusConfig(corpus);
			} catch (Exception e) {
				brClass = responses.get("error");
			}
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

		br.init(request, response, this, corpus, contextPath, remainder);
		br.processRequest();
	}

	/**
	 * Get a file from the directory belonging to this corpus.
	 *
	 * If Corpus is null, the default file is returned.
	 * If the file cannot be found (interface data directory not configured, or simply missing, or the corpus has no custom directory), the default file is returned.
	 *
	 * The default file is only returned when getDefaultIfMissing is true. Null is returned otherwise.
	 * Note that an exception is thrown if the default file is also missing, so for any files that might not have a default pass false for getDefaultIfMissing.
	 *
	 * @param corpus - corpus for which to get the file. If null, falls back to the default files.
	 * @param fileName - path to the file relative to the directory for the corpus.
	 * @param getDefaultIfMissing - attempt to retrieve the default file if the file was not found.
	 * @return the file, or null if not found
	 * @throws RuntimeException when getDefaultIfMissing is true, and the default file is missing.
	 */
	// TODO re-enable caching
	public InputStream getProjectFile(String corpus, String fileName, boolean getDefaultIfMissing) {
		if (corpus == null || isUserCorpus(corpus) || !adminProps.containsKey("corporaInterfaceDataDir") )
			return getDefaultIfMissing ? getDefaultProjectFile(fileName) : null;

		try {
			Path baseDir = Paths.get(adminProps.getProperty("corporaInterfaceDataDir"));
			Path corpusDir = baseDir.resolve(corpus).normalize();
			Path filePath = corpusDir.resolve(fileName).normalize();
			if (corpusDir.startsWith(baseDir) && filePath.startsWith(corpusDir))
				return new FileInputStream(new File(filePath.toString()));

			// File path points outside the configured directory!
			return getDefaultIfMissing ? getDefaultProjectFile(fileName) : null;
		} catch (FileNotFoundException | SecurityException e) {
			return getDefaultIfMissing ? getDefaultProjectFile(fileName) : null;
		}
	}

	/**
	 *
	 * @param fileName The file to get. This should NOT start with "/"
	 * @return the InputStream for the file.
	 * @throws RuntimeException when the file cannot be found.
	 */
	private InputStream getDefaultProjectFile(String fileName) {
		InputStream stream = getServletContext().getResourceAsStream("/WEB-INF/interface-default/" + fileName);
		if (stream == null)
			throw new RuntimeException("Default fallback for file " + fileName + " missing!");
		return stream;
	}

	public InputStream getHelpPage(String corpus) {
		return getProjectFile(corpus, "help.inc", true);
	}

	public InputStream getAboutPage(String corpus) {
		return getProjectFile(corpus, "about.inc", true);
	}

	public String getWebserviceUrl(String corpus) {
		String url = adminProps.getProperty("blsUrl");
		if (!url.endsWith("/"))
			url += "/";
		url += corpus + "/";
		return url;
	}

	public String getExternalWebserviceUrl(String corpus) {
		String url = adminProps.getProperty("blsUrlExternal");
		if (!url.endsWith("/"))
			url += "/";
		if (corpus != null && corpus.length() > 0)
			url += corpus + "/";
		return url;
	}

	public String getGoogleAnalyticsKey() {
		return adminProps.getProperty("googleAnalyticsKey", "");
	}

	public String getStylesheet(String corpus, String stylesheetName) {
		String key = corpus + "__" + stylesheetName;
		String stylesheet = stylesheets.get(key);
		if (stylesheet == null) {
			try ( InputStream is = getProjectFile(corpus, stylesheetName, true)) {
				stylesheet = IOUtils.toString(is, StandardCharsets.UTF_8);
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
			stylesheets.put(key, stylesheet);
		}
		return stylesheet;
	}

	/**
	 * Return a timestamp for when the application was built.
	 *
	 * @return build timestamp (format: yyyy-MM-dd HH:mm:ss), or UNKNOWN if
	 *   the timestamp could not be found for some reason (i.e. not running from a
	 *   JAR, or JAR was not created with the Ant buildscript).
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
							if (value == null)
								value = atts.getValue("Build-Date"); // Old name for this info
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

	public static boolean isUserCorpus(String corpus) {
		return corpus != null && corpus.indexOf(":") != -1;
	}

	public static String getCorpusName(String corpus) {
		if (corpus == null)
			return null;

		int i = corpus.indexOf(":");
		if (i != -1)
			return corpus.substring(i+1);

		return corpus;
	}

	public static String getCorpusOwner(String corpus) {
		if (corpus == null)
			return null;

		int i = corpus.indexOf(":");
		if (i != -1)
			return corpus.substring(0, i);

		return null;
	}
}
