package nl.inl.corpuswebsite.response;

import java.io.IOException;

import nl.inl.corpuswebsite.BaseResponse;

public class ConfigResponse extends BaseResponse {
    public ConfigResponse() {
        super(false);
    }

    @Override
    protected void completeRequest() throws IOException {
        displayHtmlTemplate(servlet.getTemplate("configpage"));
    }
}
