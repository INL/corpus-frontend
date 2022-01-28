package nl.inl.corpuswebsite.response;

import java.io.OutputStreamWriter;

import com.google.gson.Gson;

import nl.inl.corpuswebsite.BaseResponse;

/** Show the about page. */
public class ConfigResponse extends BaseResponse {

    private class PublicConfig {
        public String BLS_URL;
        public PublicConfig(String blsurl) {
            this.BLS_URL = blsurl;
        }
    }
    
    public ConfigResponse() {
        super(false);
    }

    @Override
    protected void completeRequest() {
        response.setCharacterEncoding(OUTPUT_ENCODING);
        response.setContentType("application/json");

        // Merge context into the page template and write to output stream
        try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING)) {   
            osw.append(new Gson().toJson(new PublicConfig(servlet.getExternalWebserviceUrl())));
            osw.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
