/**
 *
 */
package nl.inl.corpuswebsite.response;

import org.apache.velocity.VelocityContext;

import nl.inl.corpuswebsite.BaseResponse;

/** Show help page. */
public class HelpResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		putFileContentIntoContext("content", servlet.getHelpPage(corpus));
		
		VelocityContext context = getContext();
		String pathToTop = ".";
		context.put("pathToTop", pathToTop); // correct for most pages, but for "list of corpora" it's "."
		context.put("brandLink", corpus.equals("autosearch") ? pathToTop : "search");

		displayHtmlTemplate(servlet.getTemplate("contentpage"));
	}

}
