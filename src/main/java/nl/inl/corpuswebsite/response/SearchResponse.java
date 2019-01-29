package nl.inl.corpuswebsite.response;

import java.io.IOException;
import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;

public class SearchResponse extends BaseResponse {

    public SearchResponse() {
        super(true);
    }

    @Override
    protected void completeRequest() {
        context.put("blsUrl", servlet.getExternalWebserviceUrl(corpus));

        CorpusConfig config = servlet.getCorpusConfig(corpus);
        if (config == null) {
            try {
                response.sendError(404);
                return;
            } catch (IOException e) {
                // ...
            }
        }

        context.put("indexStructureJson", config.getJsonUnescaped());

        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
