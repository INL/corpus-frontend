package org.ivdnt.cf.response;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import org.ivdnt.cf.BaseResponse;
import org.ivdnt.cf.utils.CorpusConfig;
import org.ivdnt.cf.utils.QueryException;
import org.ivdnt.cf.utils.ReturnToClientException;

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

        context.put("indexStructureJson", config.getJsonUnescaped());
        context.put("pageSize", servlet.getWebsiteConfig(corpus, request, response).usePagination() ? servlet.getWebsiteConfig(corpus, request, response).getPageSize() : "undefined");
        context.put("debugInfo", servlet.debugInfo());
        
        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
