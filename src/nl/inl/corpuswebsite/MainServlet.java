/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

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

	/** Where to find the Velocity properties file */
	private final String VELOCITY_PROPERTIES = "/WEB-INF/config/velocity.properties";

	/** Where to find the Log4j properties file */
	private final String LOG4J_PROPERTIES = "/WEB-INF/config/";

	/** Our configuration parameters (from search.xml) */
	private WebsiteConfig config;

	/** Directory where the WAR was extracted to (i.e. $TOMCAT/webapps/mywar/) */
	private File warExtractDir = null;

	/** Name of the WAR file */
	private String warFileName = "";

	/** Velocity context, where we can add variables for the templating engine */
	private VelocityContext context = new VelocityContext();

	private Map<String, Template> templates = new HashMap<String, Template>();

	private Map<String, BaseResponse> responses = new HashMap<String, BaseResponse>();

	@Override
	public void init(ServletConfig cfg) throws ServletException {
		super.init();

		// initialise log4j
		LogUtil.initLog4j(new File(cfg.getServletContext().getRealPath(LOG4J_PROPERTIES)));

		try {
			startVelocity(cfg);

			// Get the name of the folder that contains our deployed war file
			warExtractDir = new File(cfg.getServletContext().getRealPath("/"));
			warFileName = warExtractDir.getName();

			// attempt to load a properties file with the same name as the folder
			File configFile = new File(cfg.getServletContext().getRealPath("/../" + warFileName + ".xml"));
			loadProperties(configFile);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}

		// initialise responses
		responses.put("/" + warFileName + "/page/search", new SearchResponse());
		responses.put("/" + warFileName + "/page/about", new AboutResponse());
		responses.put("/" + warFileName + "/page/help", new HelpResponse());
		responses.put("/" + warFileName + "/page/article", new ArticleResponse());
		responses.put("error", new ErrorResponse());

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
		}

		br.init(request, response, this);
		br.processRequest();

	}

	public File getWarExtractDir() {
		return warExtractDir;
	}

}

