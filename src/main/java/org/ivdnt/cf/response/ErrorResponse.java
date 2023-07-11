package org.ivdnt.cf.response;

import java.io.IOException;

import javax.servlet.http.HttpServletResponse;

import org.ivdnt.cf.BaseResponse;

/** Show an error page. */
public class ErrorResponse extends BaseResponse {

    public ErrorResponse() {
        super("error", false);
    }

    @Override
    protected void completeRequest() {
        context.put("error", "Response for '" + request.getRequestURI() + "' not found");

        try {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        // displayHtmlTemplate(servlet.getTemplate("error"));
    }

}
