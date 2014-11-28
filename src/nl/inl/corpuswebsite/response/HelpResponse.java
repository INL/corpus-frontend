/**
 *
 */
package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

/** Show help page. */
public class HelpResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		putFileContentIntoContext("content", servlet.getHelpPage(corpus));
		// this.getContext().put("title",
		// this.servlet.getConfig(corpus).getCorpusName());
		// this.getContext().put("websiteconfig",
		// this.servlet.getConfig(corpus));
		// this.getContext().put("googleAnalyticsKey",
		// this.servlet.getGoogleAnalyticsKey());
		displayHtmlTemplate(servlet.getTemplate("contentpage"));
	}

}
