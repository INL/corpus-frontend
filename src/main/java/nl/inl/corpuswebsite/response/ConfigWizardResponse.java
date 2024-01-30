package nl.inl.corpuswebsite.response;

import java.io.IOException;

import nl.inl.corpuswebsite.BaseResponse;

public class ConfigWizardResponse extends BaseResponse {
    public ConfigWizardResponse() {
        super("configwizard", false);
    }

    @Override
    protected void completeRequest() throws IOException {
        displayHtmlTemplate(servlet.getTemplate("configpage"));
    }
}
