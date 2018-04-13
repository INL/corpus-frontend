/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

import java.io.OutputStreamWriter;
import java.util.Arrays;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.tools.generic.EscapeTool;

public abstract class BaseResponse {
	protected static final Logger logger = Logger.getLogger(BaseResponse.class);

	private static final String OUTPUT_ENCODING = "UTF-8";

	protected MainServlet servlet;

	protected HttpServletRequest request;

	protected HttpServletResponse response;

	/** Velocity template variables */
	protected VelocityContext context = new VelocityContext();

	/** Does this response require a corpus to be set? */
	private boolean requiresCorpus = false;

	/**
	 * The corpus this response is being generated for.
	 * When on contextRoot/zeebrieven/*, this response is in the context of the zeebrieven corpus.
	 * When on contextRoot/*, this response is not in the context of any corpus.
	 * If {@link #requiresCorpus} is true, this response will only be used in the context of a corpus.
	 */
	protected String corpus = null;

	/**
	 * Whatever uri followed after the page that cause this response to be served.
	 * NOTE: is URL-encoded and contains forward slashes.
	 */
	protected String uriRemainder = null;

	/**
	 * @param requiresCorpus when set, causes an exception to be thrown when {@link BaseResponse#corpus} is not set when {@link #processRequest()} is called.
	 */
	protected BaseResponse(boolean requiresCorpus) {
		this.requiresCorpus = requiresCorpus;
	}

	/**
	 * Initialise this object with:
	 *
	 * NOTE: this function will throw an exception if corpus is required but not provided,
	 * or when a required parameter is missing.
	 *
	 * @param request the HTTP request object.
	 * @param response the HTTP response object.
	 * @param servlet our servlet.
	 * @param corpus the corpus for which this response is generated.
	 * @param contextPathAbsolute absolute path to reach the application context root.
	 * @param uriRemainder any trailing path in the original request uri, that this SHOULD be url-encoded.
	 * @throws ServletException when corpus is required but missing.
	 */
	public void init(HttpServletRequest request, HttpServletResponse response, MainServlet servlet, String corpus, String contextPathAbsolute, String uriRemainder) throws ServletException {
		if ((corpus == null || corpus.isEmpty()) && this.requiresCorpus)
			throw new ServletException("Response requires a corpus");

		if (!contextPathAbsolute.startsWith("/"))
			throw new RuntimeException("contextPathAbsolute is not an absolute path");

		this.request = request;
		this.response = response;
		this.servlet = servlet;
		this.corpus = corpus;
		this.uriRemainder = uriRemainder;

		context.put("esc", new EscapeTool());
		context.put("websiteConfig", this.servlet.getWebsiteConfig(corpus));
		context.put("pathToTop", contextPathAbsolute);
		context.put("googleAnalyticsKey", this.servlet.getGoogleAnalyticsKey());
		// TODO unify with processUrl in WebsiteConfig
		context.put("brandLink", corpus == null ? contextPathAbsolute : contextPathAbsolute + "/" + corpus + "/" + "search");
		context.put("buildTime", servlet.getWarBuildTime());
	}

	/**
	 * Display a specific template, with specific mime type
	 *
	 * @param template
	 *            template to display
	 * @param mimeType
	 *            mime type to set
	 */
	protected void displayTemplate(Template template, String mimeType) {
		// Set the content headers for the response
		response.setCharacterEncoding(OUTPUT_ENCODING);
		response.setContentType(mimeType);

		// Merge context into the page template and write to output stream
		try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING)) {
			template.merge(context, osw);
			osw.flush();
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	/**
	 * Display a template with the HTML mime type
	 *
	 * @param template
	 */
	protected void displayHtmlTemplate(Template template) {
		displayTemplate(template, "text/html");
	}

	/**
	 * Returns the value of a servlet parameter, or the default value
	 *
	 * @param name
	 *            name of the parameter
	 * @param defaultValue
	 *            default value
	 * @return value of the paramater
	 */
	public String getParameter(String name, String defaultValue) {
		// get the trimmed parameter value
		String value = request.getParameter(name);

		if (value != null) {
			value = value.trim();

			// if the parameter value is an empty string
			if (value.length() == 0)
				value = defaultValue;
		} else {
			value = defaultValue;
		}

		return value;
	}

	/**
	 * Returns the value of a servlet parameter, or the default value
	 *
	 * @param name
	 *            name of the parameter
	 * @param defaultValue
	 *            default value
	 * @return value of the paramater
	 */
	public int getParameter(String name, int defaultValue) {
		final String stringToParse = getParameter(name, "" + defaultValue);
		try {
			return Integer.parseInt(stringToParse);
		} catch (NumberFormatException e) {
			logger.info("Could not parse parameter '" + name + "', value '"
					+ stringToParse + "'. Using default (" + defaultValue + ")");
			return defaultValue;
		}
	}

	public String[] getParameterValues(String name, String defaultValue) {
		String[] values = request.getParameterValues(name);

		if (values == null)
			values = new String[] {};

		return values;
	}

	public List<String> getParameterValuesAsList(String name,
			String defaultValue) {
		return Arrays.asList(getParameterValues(name, defaultValue));
	}

	public Integer getParameter(String name, Integer defaultValue) {
		final String stringToParse = getParameter(name, "" + defaultValue);

		return new Integer(stringToParse);
	}

	/**
	 * Returns the value of a servlet parameter, or the default value.
	 *
	 * @param name name of the parameter
	 * @param defaultValue default value
	 * @return value of the paramater
	 */
	public boolean getParameter(String name, boolean defaultValue) {
		return getParameter(name, defaultValue ? "on" : "").equals("on");
	}

	/**
	 * Complete the request - automatically called by processRequest()
	 */
	abstract protected void completeRequest();

	public boolean isCorpusRequired() {
		return requiresCorpus;
	}
}
