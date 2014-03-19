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
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.util.FileUtil;

import org.apache.log4j.Logger;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;

/**
 *
 */
public abstract class BaseResponse {
	protected static final Logger logger = Logger.getLogger(BaseResponse.class);

	private final String OUTPUT_ENCODING = "UTF-8";

	protected HttpServletRequest request;
	protected HttpServletResponse response;
	protected MainServlet servlet;
	private List<String> requiredParameters;
	private StringBuilder builder = new StringBuilder();
	private VelocityContext context = new VelocityContext();

	protected BaseResponse() {
		requiredParameters = new ArrayList<String>();
	}

	/**
	 * Initialise this object with
	 * @param argRequest
	 * @param argResponse
	 * @param argServlet
	 */
	public void init(HttpServletRequest argRequest, HttpServletResponse argResponse, MainServlet argServlet) {
		request = argRequest;
		response = argResponse;
		servlet = argServlet;
	}

	/**
	 * Get the velocity context object
	 *
	 * @return velocity context
	 */
	protected VelocityContext getContext() {
		return context;
	}

	protected void clearContext() {
		context = new VelocityContext();
	}

	/**
	 * Display a specific template, with specific mime type
	 *
	 * @param argT
	 * @param mime
	 */
	protected void displayTemplate(Template argT, String mime) {
		// Set the content headers for the response
		response.setCharacterEncoding(OUTPUT_ENCODING);
		response.setContentType(mime);

		// Merge context into the page template and write to output stream
		try {
			OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING);
			try {
				argT.merge(getContext(), osw);
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
	 * @param argT
	 */
	protected void displayHtmlTemplate(Template argT) {
		displayTemplate(argT, "text/html");
	}

	/**
	 * Calls the completeRequest and logRequest implementations
	 */
	final public void processRequest() {
		// if we have enough parameters to complete this request...
		if(sufficientParameters()) {
			completeRequest();
			logRequest();
		} else {
			// insufficient parameters supplied, return error
			this.getContext().put("error", "Insufficient parameters");
			this.displayHtmlTemplate(this.servlet.getTemplate("error"));
		}
	}

	/**
	 * Add a required parameter to the list
	 * @param param
	 */
	protected void addRequiredParameter(String param) {
		requiredParameters.add(param);
	}

	/**
	 * Check if all parameters necessary to complete a search request exist
	 * @return true/false
	 */
	private boolean sufficientParameters() {
		// for each parameter in the list
		for(String p : requiredParameters) {
			// if it is missing, return false
			if(request.getParameter(p) == null)
				return false;

			// if, after trimming, it is empty, return false
			if(request.getParameter(p).trim().length() < 1)
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

		if(value != null) {
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
			logger.info("Could not parse parameter '" + name + "', value '" + stringToParse
					+ "'. Using default (" + defaultValue + ")");
			return defaultValue;
		}
	}

	public String[] getParameterValues(String name, String defaultValue) {
		String[] values = this.request.getParameterValues(name);

		if(values == null)
			values = new String[]{};

		return values;
	}

	public List<String> getParameterValuesAsList(String name, String defaultValue) {
		return Arrays.asList(getParameterValues(name, defaultValue));
	}

	public Integer getParameter(String name, Integer defaultValue) {
		final String stringToParse = getParameter(name, "" + defaultValue);

		return new Integer(stringToParse);
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
	public boolean getParameter(String name, boolean defaultValue) {
		return getParameter(name, defaultValue ? "on" : "").equals("on");
	}

	protected String getStylesheet(String name) throws IOException {
		// clear string builder
		builder.delete(0, builder.length());

		File pathToStylesheet = new File(this.servlet.getWarExtractDir(), "WEB-INF/stylesheets/" + name);
		BufferedReader br = new BufferedReader(new FileReader(pathToStylesheet));

		// read the response from the webservice
		String line;
		while( (line = br.readLine()) != null )
			builder.append(line);

		br.close();

		return builder.toString();
	}

	protected void putFileContentIntoContext(String contextKey, File pathToFile) {
		if(pathToFile.exists()) {

			List<String> lines = FileUtil.readLines(pathToFile);

			StringBuilder sb = new StringBuilder();
			for(String s : lines) {
				sb.append(s);
			}

			this.getContext().put(contextKey, sb.toString());
		}
	}

	/**
	 * Complete the request - automatically called by processRequest()
	 */
	abstract protected void completeRequest();

	/**
	 * Log the request - automatically called by processRequest()
	 */
	abstract protected void logRequest();

	abstract public BaseResponse duplicate();

}
