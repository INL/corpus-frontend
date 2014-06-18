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

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.response.AboutResponse;
import nl.inl.corpuswebsite.response.ArticleResponse;
import nl.inl.corpuswebsite.response.ErrorResponse;
import nl.inl.corpuswebsite.response.HelpResponse;
import nl.inl.corpuswebsite.response.SearchResponse;
import nl.inl.corpuswebsite.utils.WebsiteConfig;
import nl.inl.util.LogUtil;
import nl.inl.util.OsUtil;
import nl.inl.util.PropertiesUtil;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
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
	private WebsiteConfig config;

	/** Directory where the WAR was extracted to (i.e. $TOMCAT/webapps/mywar/) */
	private File warExtractDir = null;

	/** Velocity context, where we can add variables for the templating engine */
	private VelocityContext context = new VelocityContext();

	private Map<String, Template> templates = new HashMap<String, Template>();

	private Map<String, BaseResponse> responses = new HashMap<String, BaseResponse>();

	private String contextPath;

	private Properties adminProps;

	private String resultsStylesheet = null;

	private String articleStylesheet = null;

	private String metadataStylesheet;

	@Override
	public void init(ServletConfig cfg) throws ServletException {
		super.init();

		// initialise log4j
		LogUtil.initLog4j(new File(cfg.getServletContext().getRealPath(LOG4J_PROPERTIES)));

		File configFile = null;
		try {
			startVelocity(cfg);

			// Get the name of the folder that contains our deployed war file
			warExtractDir = new File(cfg.getServletContext().getRealPath("/"));
			debugLog("WAR dir: " + warExtractDir);
			contextPath = cfg.getServletContext().getContextPath();

			// attempt to load a properties file with the same name as the folder
					//new File(cfg.getServletContext().getRealPath("/../" + warFileName + ".xml"));
			configFile = new File(warExtractDir, "WEB-INF/config/project/search.xml");
			if (!configFile.exists() || !configFile.canRead())
				throw new ServletException("Config file not found or not readable: " + configFile);
			loadProperties(configFile);
			debugLog("Config file: " + configFile);

			// Load the external properties file (for administration settings)
			String adminPropFileName = warExtractDir.getName() + ".properties";
			File adminPropFile = findPropertiesFile(adminPropFileName);
			if (adminPropFile == null)
				throw new ServletException("File " + adminPropFileName + " (with webserviceInternal and webserviceExternal settings) not found in webapps or temp dir!");
			adminProps = PropertiesUtil.readFromFile(adminPropFile);
			debugLog("Admin prop file: " + adminPropFile);
			if (getWebserviceUrl() == null)
				throw new ServletException("Missing webserviceInternal setting in " + adminPropFile);
			if (getExternalWebserviceUrl() == null)
				throw new ServletException("Missing webserviceExternal setting in " + adminPropFile);
			debugLog("webserviceInternal: " + getWebserviceUrl());
			debugLog("webserviceExternal: " + getExternalWebserviceUrl());

		} catch(ServletException e) {
			throw e;
		} catch(ConfigurationException e) {
			throw new ServletException("Error reading config file: " + configFile, e);
		} catch (Exception e) {
			throw new ServletException(e);
		}

		// initialise responses
		responses.put(contextPath + "/page/search", new SearchResponse());
		responses.put(contextPath + "/page/about", new AboutResponse());
		responses.put(contextPath + "/page/help", new HelpResponse());
		responses.put(contextPath + "/page/article", new ArticleResponse());
		responses.put("error", new ErrorResponse());

	}

	private static void debugLog(String msg) {
		if (DEBUG)
			System.out.println(msg);
	}

	/**
	 * Looks for a property file with the specified name, either in the
	 * Tomcat webapps dir or in the temp dir (/tmp on Unix, C:\\temp on Windows).
	 *
	 * @param fileName property file name
	 * @return the File or null if not found
	 */
	private File findPropertiesFile(String fileName) {
		File fileInWebappsDir = new File(warExtractDir.getParentFile(), fileName);
		if (fileInWebappsDir.exists())
			return fileInWebappsDir;

		File tmpDir = OsUtil.isWindows() ? new File("C:\\temp") : new File("/tmp");
		File fileInTmpDir = new File(tmpDir, fileName);
		if (fileInTmpDir.exists())
			return fileInTmpDir;

		return null;
	}

	/**
	 * Load the properties file of this webapp
	 * @param configFile location of the config file
	 * @throws ConfigurationException *
	 */
	private void loadProperties(File configFile) throws ConfigurationException {
		config = new WebsiteConfig(configFile);
	}

	/**
	 * Start the templating engine
	 * @param servletConfig configuration object
	 * @throws Exception
	 */
	private void startVelocity(ServletConfig servletConfig) throws Exception {
		Velocity.setApplicationAttribute("javax.servlet.ServletContext", servletConfig.getServletContext());
		Velocity.init(servletConfig.getServletContext().getRealPath(VELOCITY_PROPERTIES));
	}

	/**
	 * Get the velocity template
	 * @param templateName name of the template
	 * @return velocity template
	 */
	public synchronized Template getTemplate(String templateName) {
		templateName = templateName + ".vm";

		// if the template exists
		if(Velocity.resourceExists(templateName)) {
			// if the template was already loaded
			if(templates.containsKey(templateName)) {
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
		context.put("error", "Unable to find template " + templateName);
		return getTemplate("error");
	}

	/**
	 * Return the website config
	 * @return the website config
	 */
	public WebsiteConfig getConfig() {
		return config;
	}

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) {
		processRequest(request, response);
	}

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response) {
		processRequest(request, response);
	}

	private void processRequest(HttpServletRequest request, HttpServletResponse response) {
		BaseResponse br;

		// get corresponding response object
		if(responses.containsKey(request.getRequestURI())) {
			br = responses.get(request.getRequestURI()).duplicate();
		} else {
			// if there is no corresponding response object
			// display an error
			br = responses.get("error");
			br.getContext().put("error", "Response for '" + request.getRequestURI() + "' not found");
		}

		br.init(request, response, this);
		br.processRequest();

	}

	public File getWarExtractDir() {
		return warExtractDir;
	}

	public File getHelpPage() {
		return new File(warExtractDir, "WEB-INF/config/project/help.inc");
	}

	public File getAboutPage() {
		return new File(warExtractDir, "WEB-INF/config/project/about.inc");
	}

	public String getSourceImagesLocation() {
		return adminProps.getProperty("sourceImagesLocation", "");
	}

	public String getWebserviceUrl() {
		return adminProps.getProperty("webserviceInternal");
	}

	public String getExternalWebserviceUrl() {
		return adminProps.getProperty("webserviceExternal");
	}

	public Object getGoogleAnalyticsKey() {
		return adminProps.getProperty("googleAnalyticsKey", "");
	}

	public String getResultsStylesheet() {
		if (resultsStylesheet == null) {
			try {
				resultsStylesheet = getStylesheet("results.xsl");
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
		}
		return resultsStylesheet;
	}

	public String getArticleStylesheet() {
		if (articleStylesheet == null) {
			String corpusDataFormat = getConfig().getCorpusDataFormat();
			try {
				articleStylesheet = getStylesheet("article_" + corpusDataFormat + ".xsl");
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
		}
		return articleStylesheet;
	}

	public String getMetadataStylesheet() {
		if (metadataStylesheet == null) {
			try {
				metadataStylesheet = getStylesheet("article_meta.xsl");
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
		}
		return metadataStylesheet;
	}

	public String getStylesheet(String name) throws IOException {
		// clear string builder
		StringBuilder builder = new StringBuilder();

		// Look for the stylesheet in the project config dir, or else in the stylesheets dir.
		File pathToFile = new File(getWarExtractDir(), "WEB-INF/config/project/" + name);
		if (!pathToFile.exists())
			pathToFile = new File(getWarExtractDir(), "WEB-INF/stylesheets/" + name);
		BufferedReader br = new BufferedReader(new FileReader(pathToFile));

		// read the response from the webservice
		String line;
		while( (line = br.readLine()) != null )
			builder.append(line);

		br.close();

		return builder.toString();
	}


}

