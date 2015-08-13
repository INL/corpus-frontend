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
		String pathToTop = ".";
		context.put("pathToTop", pathToTop); // correct for most pages, but for "list of corpora" it's "."
		context.put("brandLink", corpus.equals("autosearch") ? pathToTop : "search");
		context.put("blsUrl", servlet.getExternalWebserviceUrl(""));
	}

	@Override
	protected void completeRequest() {
		displayHtmlTemplate(servlet.getTemplate("corpora"));
	}

}
