package org.ivdnt.cf.response;

import java.io.IOException;
import java.io.OutputStreamWriter;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.ivdnt.cf.BaseResponse;
import org.ivdnt.cf.rest.pojo.GlobalConfigRepresentation;

/** Show the about page. */
public class ConfigResponse extends BaseResponse {
    public ConfigResponse() {
        super("config", false);
    }

    @Override
    protected void completeRequest() throws IOException {
        response.setCharacterEncoding(OUTPUT_ENCODING);
        response.setContentType("application/json");

        GlobalConfigRepresentation r = new GlobalConfigRepresentation(servlet.getGlobalConfig());

        // Merge context into the page template and write to output stream
        try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING)) {
            ObjectMapper mapper = new ObjectMapper();
            mapper.writeValue(osw, r);
            osw.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
