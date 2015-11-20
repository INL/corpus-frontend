/**
 *
 */
package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

import org.apache.velocity.VelocityContext;

/** Show help page. */
public class HelpResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		putFileContentIntoContext("content", servlet.getHelpPage(corpus));

		VelocityContext context = getContext();
		String pathToTop = corpus.equals("autosearch") ? "." : "..";
		context.put("pathToTop", pathToTop);
		context.put("brandLink", corpus.equals("autosearch") ? pathToTop : "search");

		displayHtmlTemplate(servlet.getTemplate("contentpage"));
	}

}
