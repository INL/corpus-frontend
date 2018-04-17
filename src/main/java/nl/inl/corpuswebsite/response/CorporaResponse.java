/**
 *
 */
package nl.inl.corpuswebsite.response;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;

/** Show the list of available corpora. */
public class CorporaResponse extends BaseResponse {

	public CorporaResponse() {
		super(false);
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response, MainServlet servlet, String corpus, String contextPathAbsolute, String uriRemainder) throws ServletException {
		super.init(request, response, servlet, corpus, contextPathAbsolute, uriRemainder);

		context.put("blsUrl", servlet.getExternalWebserviceUrl(""));
	}

	@Override
	protected void completeRequest() {
		displayHtmlTemplate(servlet.getTemplate("corpora"));
	}
}
