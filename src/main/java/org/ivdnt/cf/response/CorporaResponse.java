package org.ivdnt.cf.response;

import java.util.List;
import java.util.Optional;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Show the list of available corpora. */
public class CorporaResponse extends BaseResponse {

    public CorporaResponse() {
        super("corpora", false);
    }

    @Override
    public void init(HttpServletRequest request, HttpServletResponse response, MainServlet servlet, Optional<String> corpus, List<String> pathParameters)
        throws ServletException {
        super.init(request, response, servlet, corpus, pathParameters);
    }

    @Override
    protected void completeRequest() {
        displayHtmlTemplate(servlet.getTemplate("corpora"));
    }
}
