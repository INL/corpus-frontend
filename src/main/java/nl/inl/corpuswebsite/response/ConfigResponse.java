package nl.inl.corpuswebsite.response;

import java.io.OutputStreamWriter;

import com.google.gson.Gson;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.GlobalConfig;
import nl.inl.corpuswebsite.utils.GlobalConfig.Keys;

/** Show the about page. */
public class ConfigResponse extends BaseResponse {

    private static class PublicConfig {
        @Expose(serialize = false, deserialize = false)
        private final GlobalConfig config;
        public PublicConfig(GlobalConfig config) {
            this.config = config;
        }

        @SerializedName("BLS_URL")
        public String getBlsUrl() {
            // Return url on client (i.e. external). We assume the service consuming this config file is also external.
            // For example, a localhost (or docker ip) url is not useful for a client.
            return config.get(GlobalConfig.Keys.BLS_URL_ON_CLIENT);
        }

        @SerializedName("commit_hash")
        public String getCommitHash() {
            return GlobalConfig.commitHash;
        }
        @SerializedName("commit_time")
        public String getCommitTime() {
            return GlobalConfig.commitTime;
        }
        @SerializedName("commit_message")
        public String getCommitMessage() {
            return GlobalConfig.commitMessage;
        }
        @SerializedName("version")
        public String getVersion() {
            return GlobalConfig.version;
        }
    }
    
    public ConfigResponse() {
        super("config", false);
    }

    @Override
    protected void completeRequest() {
        response.setCharacterEncoding(OUTPUT_ENCODING);
        response.setContentType("application/json");

        // Merge context into the page template and write to output stream
        try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), OUTPUT_ENCODING)) {   
            osw.append(new Gson().toJson(new PublicConfig(servlet.getGlobalConfig())));
            osw.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
