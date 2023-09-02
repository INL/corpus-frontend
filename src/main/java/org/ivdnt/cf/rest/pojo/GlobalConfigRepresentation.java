package org.ivdnt.cf.rest.pojo;

import org.ivdnt.cf.GlobalConfigProperties;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

@JsonAutoDetect(fieldVisibility = Visibility.NONE, getterVisibility = Visibility.NONE, isGetterVisibility = Visibility.NONE)

@JacksonXmlRootElement(localName = "config")
public class GlobalConfigRepresentation {
    private final GlobalConfigProperties config;

    public GlobalConfigRepresentation(GlobalConfigProperties config) {
        this.config = config;
    }

    @JsonProperty("blacklab_server")
    public String getBlacklabServer() {
        return config.getBlsUrlExternal();
    }

    @JsonProperty("banner_message")
    public String getBannerMessage() {
        return config.getBannerMessage();
    }
}
