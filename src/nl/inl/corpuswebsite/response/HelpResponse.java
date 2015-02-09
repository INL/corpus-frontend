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
		context.put("pathToTop", "."); // correct for most pages, but for "list of corpora" it's "."

		displayHtmlTemplate(servlet.getTemplate("contentpage"));
	}

}
