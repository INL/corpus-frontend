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
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.jar.Attributes;
import java.util.jar.Manifest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.parsers.ParserConfigurationException;

import org.apache.commons.lang.SystemUtils;
import org.apache.log4j.PropertyConfigurator;
import org.apache.velocity.Template;
import org.apache.velocity.app.Velocity;
import org.xml.sax.SAXException;

import nl.inl.corpuswebsite.response.AboutResponse;
import nl.inl.corpuswebsite.response.ArticleResponse;
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
	 * If the URL doesn't contain the corpus name, this is the default corpus we
	 * use.
	 */
	private String defaultCorpus = "autosearch";

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

		// initialise responses
		responses.put(contextPath + "/page/search", SearchResponse.class);
		responses.put(contextPath + "/page/about", AboutResponse.class);
		responses.put(contextPath + "/page/help", HelpResponse.class);
		responses.put(contextPath + "/page/article", ArticleResponse.class);
		responses.put(contextPath + "/help", HelpResponse.class);
		responses.put(contextPath, CorporaResponse.class);
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

		File tmpDir = isWindows ? new File(System.getProperty("java.io.tmpdir")) : new File(
				"/tmp");
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
	 * Return the website config
	 *
	 * @param corpus
	 *            config for which corpus to read
	 * @return the website config
	 */
	public WebsiteConfig getConfig(String corpus) {

		try (InputStream configFileInputStream = getProjectFile(corpus, "search.xml", true)) {
			return new WebsiteConfig(configFileInputStream);
		} catch (Exception e) {
			throw new RuntimeException("Error reading config file for corpus " + corpus, e);
		}
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

			Map<String, String[]> params = new HashMap<>();
			params.put("outputformat", new String[] {"xml"});

			try {
				String xmlResult = handler.makeRequest(params);
				corpusConfigs.put(corpus, new CorpusConfig(xmlResult));
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

	private void processRequest(HttpServletRequest request,
			HttpServletResponse response) throws ServletException {
		BaseResponse br;

		String requestUri = request.getRequestURI();
		String corpus = defaultCorpus; // corpus to use if not in URL path

		// URL: contextPath/corpusName/resource
		// (corpusName is of the form [[userid]:]name), and userid usually
		//  looks like an email address (though it may not BE one))
		Pattern p = Pattern.compile("^" + contextPath
				+ "/([a-zA-Z0-9\\-\\._!\\$&'\\(\\)\\*\\+,;:=@]+)/([a-zA-Z0-9\\-_]+)/?$");
		Matcher m = p.matcher(requestUri);
		if (m.matches() && !m.group(1).equals("page")) {
			// Yes, corpus name specified. Use that.
			corpus = m.group(1);
			String operation = m.group(2);
			// Translate back to old URI style.
			requestUri = contextPath + "/page/" + operation;
		}

		// Strip trailing slash
		if (requestUri.endsWith("/"))
			requestUri = requestUri.substring(0, requestUri.length() - 1);

		// Get response class
		Class<? extends BaseResponse> brClass;
		if (responses.containsKey(requestUri)) {
			brClass = responses.get(requestUri);
		} else {
			// If there is no corresponding response object, display an error
			brClass = responses.get("error");
		}

		// Instantiate response class
		try {
			br = brClass.getConstructor().newInstance();
		} catch (Exception e) {
			throw new ServletException(e);
		}

		br.setCorpus(corpus);

		br.init(request, response, this);
		br.processRequest();

	}

	/**
	 * Look for project-specific version of file. If not found, return a generic
	 * version.
	 *
	 * @param corpus
	 *            corpus we're searching
	 * @param fileName
	 *            file we're looking for
	 * @param mustExist
	 *            if true, throws an exception if not found; otherwise just
	 *            returns null
	 * @return the appropriate instance of the file to use
	 */
//	private InputStream getProjectFile(String corpus, String fileName, boolean mustExist) {
//		if (corpus.length() > 0) {
//			if (corpus.equals("chn-i"))
//				corpus = "chn"; // HACK
//
//			String fn = "/projectconfigs/" + corpus + "/" + fileName;
//			InputStream is = getServletContext().getResourceAsStream(fn);
//			if (is != null) {
//				//System.out.println("* File exists: " + fn);
//				return is;
//			}
//			//System.out.println("* File doesn't exist: " + fn);
//		}
//
//		if (mustExist)
//			throw new RuntimeException("Couldn't find file '" + fileName + "' for corpus '" + corpus + "'");
//		return null;
//		// return new File(warExtractDir, "WEB-INF/config/project/" + fileName);
//	}


	//first check if file exists within configured folder
	//then get fallback

	/**
	 *
	 * @param corpus
	 * @param fileName
	 * @param mustExist
	 * @return the file, the file returned will be the default file if the file cannot be found in the corpus specific folder
	 */
	// TODO: check if the corpus is a user corpus, and if it is, always return the default files.
	private InputStream getProjectFile(String corpus, String fileName, boolean mustExist) {
		if (!adminProps.containsKey("corporaInterfaceDataDir"))
			return getDefaultProjectFile(fileName, mustExist);

		// TODO solve the case where corpusname like corpus/../othercorpus will access file in dir 'othercorpus'

		try {
			Path baseDir = Paths.get(adminProps.getProperty("corporaInterfaceDataDir"));
			Path corpusDir = baseDir.resolve(corpus).normalize();
			Path filePath = corpusDir.resolve(fileName).normalize();
			if (corpusDir.startsWith(baseDir) && filePath.startsWith(corpusDir))
				return new FileInputStream(new File(filePath.toString()));

			return getDefaultProjectFile(fileName, mustExist);
		} catch (InvalidPathException | FileNotFoundException | SecurityException e) {
			// TODO: remove InvalidPathException when we no longer attempt to serve custom files for user corpora
			// (only user corpora contain
			return getDefaultProjectFile(fileName, mustExist);
		}
	}

	/**
	 * @param fileName
	 * @param mustExist
	 * @return
	 */
	private InputStream getDefaultProjectFile(String fileName, boolean mustExist) {
		InputStream stream = getServletContext().getResourceAsStream("/WEB-INF/interface-default/" + fileName);
		if (mustExist && stream == null)
			throw new RuntimeException("Required file " + fileName + " missing!");
		return stream;
	}

	public InputStream getHelpPage(String corpus) {
		return getProjectFile(corpus, "help.inc", true);
	}

	public InputStream getAboutPage(String corpus) {
		return getProjectFile(corpus, "about.inc", true);
	}

	public String getSourceImagesLocation(String corpus) {
		String sourceImagesLocation = adminProps.getProperty("sourceImagesLocation", "");
		String corpusSpecificImagesLocation = adminProps.getProperty("sourceImagesLocation_" + corpus, "");
		if (corpusSpecificImagesLocation.length() > 0)
			return corpusSpecificImagesLocation;
		if (sourceImagesLocation.length() == 0)
			return "";
		return sourceImagesLocation + corpus + "/";
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

	public String getGoogleAnalyticsKey(String corpus) {
		String googleAnalyticsKey = adminProps.getProperty("googleAnalyticsKey", "");
		String googleAnalyticsKeyThisCorpus = adminProps.getProperty("googleAnalyticsKey_" + corpus, "");
		if (googleAnalyticsKeyThisCorpus.length() > 0)
			return googleAnalyticsKeyThisCorpus;
		return googleAnalyticsKey;
	}

	public String getStylesheet(String corpus, String stylesheetName) {
		String key = corpus + "__" + stylesheetName;
		String stylesheet = stylesheets.get(key);
		if (stylesheet == null) {
			// Look for the stylesheet in the project config dir, or else in the
			// stylesheets dir.
			try ( InputStream is = openStylesheet(corpus, stylesheetName);
				  BufferedReader br = new BufferedReader(new InputStreamReader(is)) ) {
				// read the response from the webservice
				String line;
				StringBuilder builder = new StringBuilder();
				while ((line = br.readLine()) != null)
					builder.append(line);
				stylesheet = builder.toString();
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
			stylesheets.put(key, stylesheet);
		}
		return stylesheet;
	}

	private InputStream openStylesheet(String corpus, String stylesheetName) {
		InputStream is = getProjectFile(corpus, stylesheetName, false);
		if (is == null)
			is = getServletContext().getResourceAsStream("/WEB-INF/stylesheets/" + stylesheetName);
		return is;
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
}
