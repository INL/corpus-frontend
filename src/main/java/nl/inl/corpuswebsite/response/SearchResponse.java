package nl.inl.corpuswebsite.response;

import java.io.IOException;

import nl.inl.corpuswebsite.BaseResponse;

public class SearchResponse extends BaseResponse {

    public SearchResponse() {
        super("search", true);
    }

    @Override
    protected void completeRequest() throws IOException {
//        CorpusConfig config = servlet
//                .getCorpusConfig(corpus, request, response)
//                .getOrThrow(e -> {
//                    String message = "Error retrieving corpus information" + (e.getMessage() != null ? ": " + e.getMessage() : "");
//                    return new ReturnToClientException(e instanceof QueryException ? ((QueryException) e).getHttpStatusCode() : HttpServletResponse.SC_INTERNAL_SERVER_ERROR, message);
//                });

//        model.put("indexStructureJson", config.getJsonUnescaped());
        model.put("pageSize", servlet.getWebsiteConfig(corpus).usePagination() ? servlet.getWebsiteConfig(corpus).getPageSize() : "undefined");
        model.put("debugInfo", servlet.debugInfo());
        
        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
