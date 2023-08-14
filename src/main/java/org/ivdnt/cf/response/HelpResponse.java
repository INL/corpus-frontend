package org.ivdnt.cf.response;

import java.io.IOException;
import java.io.InputStream;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;

import org.ivdnt.cf.BaseResponse;

/** Show help page. */
public class HelpResponse extends BaseResponse {

    public HelpResponse() {
        super("help", false);
    }

    @Override
    protected void completeRequest() {
        try (InputStream is = servlet.getHelpPage(corpus)) {
            if (is != null) {
                context.put("content", StringUtils.join(IOUtils.readLines(is, "utf-8"), "\n"));
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        displayHtmlTemplate(servlet.getTemplate("contentpage"));
    }

}
