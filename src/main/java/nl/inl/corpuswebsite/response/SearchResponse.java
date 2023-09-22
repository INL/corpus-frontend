package nl.inl.corpuswebsite.response;

import java.io.IOException;

import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryException;
import nl.inl.corpuswebsite.utils.ReturnToClientException;

public class SearchResponse extends BaseResponse {

    public SearchResponse() {
        super("search", true);
    }

    @Override
    protected void completeRequest() throws IOException {
        CorpusConfig config = servlet
                .getCorpusConfig(corpus, request, response)
                .getOrThrow(e -> {
                    String message = "Error retrieving corpus information" + (e.getMessage() != null ? ": " + e.getMessage() : "");
                    return new ReturnToClientException(e instanceof QueryException ? ((QueryException) e).getHttpStatusCode() : HttpServletResponse.SC_INTERNAL_SERVER_ERROR, message);
                });

        model.put("indexStructureJson", config.getJsonUnescaped());
        model.put("pageSize", servlet.getWebsiteConfig(corpus, request, response).usePagination() ? servlet.getWebsiteConfig(corpus, request, response).getPageSize() : "undefined");
        model.put("debugInfo", servlet.debugInfo());
        
        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
