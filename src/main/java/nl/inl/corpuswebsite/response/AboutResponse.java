/**
 *
 */
package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

/** Show the about page. */
public class AboutResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		putFileContentIntoContext("content", servlet.getAboutPage(corpus));
		displayHtmlTemplate(servlet.getTemplate("contentpage"));

	}

}
