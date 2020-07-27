package nl.inl.corpuswebsite.response;

import java.io.IOException;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.tuple.Pair;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;
import nl.inl.corpuswebsite.utils.QueryServiceHandler.QueryException;

public class SearchResponse extends BaseResponse {

    public SearchResponse() {
        super(true);
    }

    @Override
    protected void completeRequest() throws IOException {
        Pair<CorpusConfig, Exception> blackLabInfo = servlet.getCorpusConfig(corpus);
        if (blackLabInfo.getRight() != null) {
            Exception e = blackLabInfo.getRight();
            String message = "Error retrieving corpus information" + (e.getMessage() != null ? ": " + e.getMessage() : "");
            int code = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
            if (e instanceof QueryException) {
                QueryException qe = (QueryException) e;
                code = qe.getHttpStatusCode();
                    
                if (code == HttpServletResponse.SC_NOT_FOUND) {
                    message = null;
                } else {
                    message = "Error retrieving corpus information - unexpected BlackLab response.";
                }
            }

            if (message != null) {
                response.sendError(code, message);
            } else { 
                response.sendError(code);
            }
            return;
        }

        CorpusConfig cfg = blackLabInfo.getLeft();
        
        context.put("indexStructureJson", cfg.getJsonUnescaped());
        context.put("pageSize", servlet.getWebsiteConfig(corpus).usePagination() ? servlet.getWebsiteConfig(corpus).getPageSize() : "undefined");

        // display template
        displayHtmlTemplate(servlet.getTemplate("search"));
    }
}
