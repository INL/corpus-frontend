package nl.inl.corpuswebsite.response;

import nl.inl.corpuswebsite.BaseResponse;

public class RemoteIndexResponse extends BaseResponse {

    public RemoteIndexResponse() {
        super(false);
    }

    @Override
    protected void completeRequest() {
        displayHtmlTemplate(servlet.getTemplate("remote-index"));
    }
}
