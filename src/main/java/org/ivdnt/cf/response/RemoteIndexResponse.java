package org.ivdnt.cf.response;

public class RemoteIndexResponse extends BaseResponse {

    public RemoteIndexResponse() {
        super("remote-index", false);
    }

    @Override
    protected void completeRequest() {
        displayHtmlTemplate(servlet.getTemplate("remote-index"));
    }
}
