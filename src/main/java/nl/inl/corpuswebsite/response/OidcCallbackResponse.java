package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

/** Show help page. */
public class OidcCallbackResponse extends BaseResponse {
    public OidcCallbackResponse() {
        super("callback", false);
    }

    @Override
    protected void completeRequest() {
        displayHtmlTemplate(servlet.getTemplate("callback"));
    }
}
