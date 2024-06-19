package nl.inl.corpuswebsite.response;

import java.io.IOException;

import nl.inl.corpuswebsite.BaseResponse;

public class SearchResponse extends BaseResponse {

    public SearchResponse() {
        super("search", true);
    }

    @Override
    protected void completeRequest() throws IOException {
        model.put("pageSize", servlet.getWebsiteConfig(corpus).getPageSize().map(Object::toString).orElse("undefined"));
        model.put("debugInfo", servlet.debugInfo());
        
        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
