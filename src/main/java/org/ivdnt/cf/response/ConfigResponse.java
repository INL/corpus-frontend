package org.ivdnt.cf.response;

import java.io.IOException;
import java.io.OutputStreamWriter;

import com.fasterxml.jackson.databind.ObjectMapper;
//import com.google.gson.Gson;

import org.ivdnt.cf.BaseResponse;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.rest.pojo.GlobalConfigRepresentation;

/** Show the about page. */
public class ConfigResponse extends BaseResponse {

    private class PublicConfig {
        public String BLS_URL;
        public PublicConfig(String blsurl) {
            this.BLS_URL = blsurl;
        }
    }
    
    public ConfigResponse() {
        super("config", false);
    }

    @Override
    protected void completeRequest() throws IOException {
        response.setCharacterEncoding(OUTPUT_ENCODING);
        response.setContentType("application/json");

        // HACK: this class to be removed in favor of REST api implementation.
        String warName = servlet.getServletContext().getContextPath().replaceAll("^/", "");
        String adminPropFileName = warName + ".properties";
        GlobalConfigRepresentation r = new GlobalConfigRepresentation(new GlobalConfig(servlet.findPropertiesFile(adminPropFileName)));

        // Merge context into the page template and write to output stream
        try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING)) {
            ObjectMapper mapper = new ObjectMapper();
            mapper.writeValue(osw, r);

//            osw.append(new Gson().toJson(new PublicConfig(servlet.getExternalWebserviceUrl())));
            osw.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
