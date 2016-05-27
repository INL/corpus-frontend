/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.InputStream;

import nl.inl.corpuswebsite.BaseResponse;

/** Show the about page. */
public class AboutResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		try (InputStream is = servlet.getAboutPage(corpus)) {
			putFileContentIntoContext("content", is);
		} catch (IOException e) {
			throw new RuntimeException(e);
		}

		displayHtmlTemplate(servlet.getTemplate("contentpage"));

	}

}
