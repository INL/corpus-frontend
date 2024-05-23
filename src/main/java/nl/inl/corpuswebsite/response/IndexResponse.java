package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.InputStream;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.BaseResponse;

/** Show the about page. */
public class IndexResponse extends BaseResponse {

    public IndexResponse() {
        super("index", false);
    }

    @Override
    protected void completeRequest() {
        displayHtmlTemplate(servlet.getTemplate("contentpage"));
    }
}
