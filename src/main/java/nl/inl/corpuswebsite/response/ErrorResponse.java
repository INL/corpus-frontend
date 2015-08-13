/**
 *
 */
package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

/** Show an error page. */
public class ErrorResponse extends BaseResponse {

	@Override
	protected void completeRequest() {

		getContext().put("error",
				"Response for '" + request.getRequestURI() + "' not found");

		displayHtmlTemplate(servlet.getTemplate("error"));
	}

}
