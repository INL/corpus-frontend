/**
 * Copyright (c) 2010, 2012 Institute for Dutch Lexicology.
 * All rights reserved.
 *
 * @author VGeirnaert
 */
package nl.inl.corpuswebsite;

import java.io.File;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.util.FileUtil;
import nl.inl.util.StringUtil;

import org.apache.log4j.Logger;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;

/**
 *
 */
public abstract class BaseResponse {
	protected static final Logger logger = Logger.getLogger(BaseResponse.class);

	private static final String OUTPUT_ENCODING = "UTF-8";

	protected MainServlet servlet;

	protected HttpServletRequest request;

	protected HttpServletResponse response;

	/** Required parameters for this operation */
	private List<String> requiredParameters;

	/** Velocity template variables */
	private VelocityContext context = new VelocityContext();

	/** The corpus to use */
	protected String corpus = "";

	protected BaseResponse() {
		requiredParameters = new ArrayList<String>();
	}

	/**
	 * Initialise this object with
	 *
	 * @param request
	 *            the HTTP request object
	 * @param response
	 *            the HTTP response object
	 * @param servlet
	 *            our servlet
	 */
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		this.request = request;
		this.response = response;
		this.servlet = servlet;

		VelocityContext context = getContext();
		context.put("title", this.servlet.getConfig(corpus).getCorpusName());
		context.put("websiteconfig", this.servlet.getConfig(corpus));
		context.put("googleAnalyticsKey", this.servlet.getGoogleAnalyticsKey());
		String pathToTop = "..";
		context.put("pathToTop", pathToTop); // correct for most pages, but for "list of corpora" it's "."
		context.put("brandLink", corpus.equals("autosearch") ? pathToTop : "./search");
		context.put("buildTime", servlet.getWarBuildTime());
	}

	/**
	 * Get the velocity context object
	 *
	 * @return velocity context
	 */
	protected VelocityContext getContext() {
		return context;
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
		try {
			OutputStreamWriter osw = new OutputStreamWriter(
					response.getOutputStream(), OUTPUT_ENCODING);
			try {
				template.merge(context, osw);
				osw.flush();
			} finally {
				osw.close();
			}
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	/**
	 * Display a template with the XML mime type
	 *
	 * @param template
	 */
	protected void displayHtmlTemplate(Template template) {
		displayTemplate(template, "text/html");
	}

	/**
	 * Calls the completeRequest and logRequest implementations
	 */
	final public void processRequest() {
		// if we have enough parameters to complete this request...
		if (sufficientParameters()) {
			completeRequest();
		} else {
			// insufficient parameters supplied, return error
			context.put("error", "Insufficient parameters");
			displayHtmlTemplate(servlet.getTemplate("error"));
		}
	}

	/**
	 * Add a required parameter to the list.
	 *
	 * @param param
	 *            parameter name
	 */
	protected void addRequiredParameter(String param) {
		requiredParameters.add(param);
	}

	/**
	 * Check if all parameters necessary to complete a search request exist.
	 *
	 * @return true if they do, false if not
	 */
	private boolean sufficientParameters() {
		// for each parameter in the list
		for (String p: requiredParameters) {
			// if it is missing, return false
			if (request.getParameter(p) == null)
				return false;

			// if, after trimming, it is empty, return false
			if (request.getParameter(p).trim().length() == 0)
				return false;
		}

		// everything is accounted for, return true!
		return true;
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

	protected void putFileContentIntoContext(String contextKey, File pathToFile) {
		if (pathToFile.exists()) {

			List<String> lines = FileUtil.readLines(pathToFile);
			context.put(contextKey, StringUtil.join(lines, "\n"));
		}
	}

	/**
	 * Complete the request - automatically called by processRequest()
	 */
	abstract protected void completeRequest();

	public void setCorpus(String corpus) {
		this.corpus = corpus;
	}

//	public void setSinglePageTest(boolean b) {
//		context.put("singlePageTest", b);
//	}

}
