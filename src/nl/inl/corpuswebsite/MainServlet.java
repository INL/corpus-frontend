/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.response.AboutResponse;
import nl.inl.corpuswebsite.response.ArticleResponse;
import nl.inl.corpuswebsite.response.CorporaResponse;
import nl.inl.corpuswebsite.response.ErrorResponse;
import nl.inl.corpuswebsite.response.HelpResponse;
import nl.inl.corpuswebsite.response.SearchResponse;
import nl.inl.corpuswebsite.response.SingleResponse;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.util.LogUtil;
import nl.inl.util.OsUtil;
import nl.inl.util.PropertiesUtil;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.velocity.Template;
import org.apache.velocity.app.Velocity;

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
	private final String LOG4J_PROPERTIES = "/WEB-INF/config/";

	/** Our configuration parameters (from search.xml) */
	private Map<String, WebsiteConfig> configs = new HashMap<String, WebsiteConfig>();

	/** Directory where the WAR was extracted to (i.e. $TOMCAT/webapps/mywar/) */
	private File warExtractDir = null;

	/** Our Velocity templates */
	private Map<String, Template> templates = new HashMap<String, Template>();

	/** The response classes for our URI patterns */
	private Map<String, Class<? extends BaseResponse>> responses = new HashMap<String, Class<? extends BaseResponse>>();

	/** Our context path (first part of our URI path) */
	private String contextPath;

	/** Properties from the external config file, e.g. BLS URLs, Google Analytics key, etc. */
	private Properties adminProps;

	/** Our cached XSL stylesheets */
	private Map<String, String> stylesheets = new HashMap<String, String>();

	/**
	 * If the URL doesn't contain the corpus name, this is the default corpus we
	 * use. We determine this from the name of the .war file (i.e.
	 * zeebrieven.war defaults to zeebrieven, etc.)
	 */
	private String defaultCorpus = "chn";

	@Override
	public void init(ServletConfig cfg) throws ServletException {
		super.init();

		// initialise log4j
		LogUtil.initLog4j(new File(cfg.getServletContext().getRealPath(
				LOG4J_PROPERTIES)));

		try {
			startVelocity(cfg);

			// Get the name of the folder that contains our deployed war file
			warExtractDir = new File(cfg.getServletContext().getRealPath("/"));
			debugLog("WAR dir: " + warExtractDir);
			String warName = warExtractDir.getName();

			// Determine default corpus name from the .war file name
			// (this is the "old" way of doing it, with a separate war for each
			// corpus; the "new" way is one war for all corpora, dynamically
			// switching based on URL path)
			if (warName.equals("zeebrieven") || warName.equals("gysseling")
					|| warName.equals("surinaams"))
				defaultCorpus = warName;
			debugLog("Default corpus name: " + defaultCorpus);
			contextPath = cfg.getServletContext().getContextPath();

			// Load the external properties file (for administration settings)
			String adminPropFileName = warName + ".properties";
			File adminPropFile = findPropertiesFile(adminPropFileName);
			if (adminPropFile == null)
				throw new ServletException(
						"File "
								+ adminPropFileName
								+ " (with blsUrl and blsUrlExternal settings) not found in webapps or temp dir!");
			adminProps = PropertiesUtil.readFromFile(adminPropFile);
			debugLog("Admin prop file: " + adminPropFile);
			if (!adminProps.containsKey("blsUrl"))
				throw new ServletException("Missing blsUrl setting in "
						+ adminPropFile);
			if (!adminProps.containsKey("blsUrlExternal"))
				throw new ServletException("Missing blsUrlExternal setting in "
						+ adminPropFile);
			debugLog("blsUrl: " + adminProps.getProperty("blsUrl"));
			debugLog("blsUrlExternal: "
					+ adminProps.getProperty("blsUrlExternal"));

		} catch (ServletException e) {
			throw e;
		} catch (Exception e) {
			throw new ServletException(e);
		}

		// initialise responses
		responses.put(contextPath + "/page/single", SingleResponse.class);
		responses.put(contextPath + "/page/search", SearchResponse.class);
		responses.put(contextPath + "/page/about", AboutResponse.class);
		responses.put(contextPath + "/page/help", HelpResponse.class);
		responses.put(contextPath + "/page/article", ArticleResponse.class);
		responses.put(contextPath, CorporaResponse.class);
		responses.put("error", ErrorResponse.class);

	}

	private static void debugLog(String msg) {
		if (DEBUG)
			System.out.println(msg);
	}

	/**
	 * Looks for a property file with the specified name, either in the Tomcat
	 * webapps dir or in the temp dir (/tmp on Unix, C:\\temp on Windows).
	 *
	 * @param fileName
	 *            property file name
	 * @return the File or null if not found
	 */
	private File findPropertiesFile(String fileName) {
		File fileInWebappsDir = new File(warExtractDir.getParentFile(),
				fileName);
		if (fileInWebappsDir.exists())
			return fileInWebappsDir;

		File tmpDir = OsUtil.isWindows() ? new File("C:\\temp") : new File(
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
		Velocity.init(servletConfig.getServletContext().getRealPath(
				VELOCITY_PROPERTIES));
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
		File configFile = null;
		try {
			if (!configs.containsKey(corpus)) {
				// attempt to load a properties file with the same name as the
				// folder
				// new File(cfg.getServletContext().getRealPath("/../" +
				// warFileName + ".xml"));
				configFile = getProjectFile(corpus, "search.xml", false);
				if (configFile == null) {
					// No corpus-specific config. Use generic for now (we'll detect stuff later)
					configs.put(corpus, WebsiteConfig.generic(corpus));
				} else {
					if (!configFile.exists() || !configFile.canRead())
						throw new RuntimeException(
								"Config file not found or not readable: "
										+ configFile);
					configs.put(corpus, new WebsiteConfig(configFile));
					debugLog("Config file: " + configFile);
				}
			}
		} catch (ConfigurationException e) {
			throw new RuntimeException("Error reading config file: "
					+ configFile, e);
		}

		return configs.get(corpus);
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

		// NEW STYLE: /contextpath/CORPUS/operation ?
		Pattern p = Pattern.compile("^" + contextPath
				+ "/([a-zA-Z0-9\\-_:]+)/([a-zA-Z0-9\\-_]+)/?$");
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
		if (requestUri.endsWith("/single")) {
			br.setSinglePageTest(true);
		}

		br.init(request, response, this);
		br.processRequest();

	}

	public File getWarExtractDir() {
		return warExtractDir;
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
	private File getProjectFile(String corpus, String fileName,
			boolean mustExist) {
		if (corpus.length() > 0) {
			System.out.println("* Corpus: " + corpus);
			File file = new File(warExtractDir, "projectconfigs/" + corpus
					+ "/" + fileName);
			if (file.exists()) {
				System.out.println("* File exists: " + file);
				return file;
			}
			System.out.println("* File doesn't exist: " + file);
		}

		if (mustExist)
			throw new RuntimeException("Couldn't find file '" + fileName
					+ "' for corpus '" + corpus + "'");
		return null;
		// return new File(warExtractDir, "WEB-INF/config/project/" + fileName);
	}

	public File getHelpPage(String corpus) {
		return getProjectFile(corpus, "help.inc", true);
	}

	public File getAboutPage(String corpus) {
		return getProjectFile(corpus, "about.inc", true);
	}

	public String getSourceImagesLocation() {
		return adminProps.getProperty("sourceImagesLocation", "");
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

	public Object getGoogleAnalyticsKey() {
		return adminProps.getProperty("googleAnalyticsKey", "");
	}

	public String getStylesheet(String corpus, String stylesheetName) {
		String key = corpus + "__" + stylesheetName;
		String stylesheet = stylesheets.get(key);
		if (stylesheet == null) {
			// Look for the stylesheet in the project config dir, or else in the
			// stylesheets dir.
			File pathToFile = getProjectFile(corpus, stylesheetName, false);
			if (pathToFile == null || !pathToFile.exists())
				pathToFile = new File(getWarExtractDir(),
						"WEB-INF/stylesheets/" + stylesheetName);
			try {
				BufferedReader br = new BufferedReader(new FileReader(
						pathToFile));

				// read the response from the webservice
				String line;
				StringBuilder builder = new StringBuilder();
				while ((line = br.readLine()) != null)
					builder.append(line);

				br.close();
				stylesheet = builder.toString();
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
			stylesheets.put(key, stylesheet);
		}
		return stylesheet;
	}

	public String getApplicationTitle() {
		return "AutoSearch";
	}

	public String getSpecialField(String corpus, String fieldType) {
		String field = getConfig(corpus).getFieldIndexForFunction(fieldType);
		if (field != null && field.length() > 0)
			return field;
		
		// TODO: query BLS for the special fields title, date, author
		return fieldType;
	}

}
