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
        context.put("pageSize", this.servlet.getWordsToShow());

        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
