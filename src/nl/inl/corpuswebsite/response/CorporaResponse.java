/**
 *
 */
package nl.inl.corpuswebsite.response;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;

import org.apache.velocity.VelocityContext;

/** Show the list of available corpora. */
public class CorporaResponse extends BaseResponse {
	
	@Override
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		corpus = "autosearch"; // generic interface
		super.init(request, response, servlet);
		
		VelocityContext context = getContext();
		context.put("title", servlet.getConfig(corpus).getCorpusName() + ": Corpora");
		context.put("pathToTop", "."); // we're the "top level page", so different relative path
		context.put("blsUrl", servlet.getExternalWebserviceUrl(""));
	}

	@Override
	protected void completeRequest() {
		displayHtmlTemplate(servlet.getTemplate("corpora"));
	}

}
