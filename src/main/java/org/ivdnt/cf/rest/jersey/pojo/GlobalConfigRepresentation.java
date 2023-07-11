package org.ivdnt.cf.rest.jersey.pojo;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.ivdnt.cf.GlobalConfig;

@JsonAutoDetect(fieldVisibility = Visibility.NONE, getterVisibility = Visibility.NONE, isGetterVisibility = Visibility.NONE)
public class GlobalConfigRepresentation {
    private final GlobalConfig config;
    public GlobalConfigRepresentation(GlobalConfig config) {
        this.config = config;
    }

    @JsonProperty("blacklab_server")
    public String blacklab() {
        return config.get(GlobalConfig.Keys.PROP_BLS_CLIENTSIDE);
    }
}
