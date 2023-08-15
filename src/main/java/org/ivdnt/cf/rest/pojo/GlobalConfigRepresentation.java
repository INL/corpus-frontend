package org.ivdnt.cf.rest.pojo;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;
import org.ivdnt.cf.GlobalConfig;

@JsonAutoDetect(fieldVisibility = Visibility.NONE, getterVisibility = Visibility.NONE, isGetterVisibility = Visibility.NONE)

@XmlRootElement(name = "global_config")
@XmlAccessorType(XmlAccessType.NONE)
public class GlobalConfigRepresentation {
    private final GlobalConfig config;

    // JAXB needs a no-arg constructor
    private GlobalConfigRepresentation() {  this.config = new GlobalConfig(); }
    public GlobalConfigRepresentation(GlobalConfig config) {
        this.config = config;
    }


    @JsonProperty("blacklab_server")
    @XmlElement(name = "blacklab_server")
    public String getBlacklabServer() {
        return config.get(GlobalConfig.Keys.PROP_BLS_CLIENTSIDE);
    }

    // JAXB :(
//    @XmlElement(name = "blacklab_server")
//    public void setBlacklabServer(String value) { }
}
