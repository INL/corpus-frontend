/**
 *
 */
package nl.inl.corpuswebsite.response;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;

/**
 *
 */
public class SingleResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		
		getContext().put("title", servlet.getConfig(corpus).getCorpusName());
		getContext().put("wordproperties",
				servlet.getConfig(corpus).getWordProperties());
		getContext().put("websiteconfig", servlet.getConfig(corpus));
		getContext().put("googleAnalyticsKey", servlet.getGoogleAnalyticsKey());

		// display template
		displayHtmlTemplate(servlet.getTemplate("single"));
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		super.init(request, response, servlet);
	}

}
