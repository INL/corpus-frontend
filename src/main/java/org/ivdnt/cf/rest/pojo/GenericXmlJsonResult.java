package org.ivdnt.cf.rest.pojo;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;

/**
 * Wrapper object to allow us to return strings inside a json or xml structure
 * Jersey by default throws a fit if you return a String from a function that's supposed to return xml or json,
 * so we wrap it in one of these and it's happy (since it can serialize this).
 */
@XmlRootElement(name="result")
public class GenericXmlJsonResult {
    String content;

    public GenericXmlJsonResult() {}
    public GenericXmlJsonResult(String content) {
        this.content = content;
    }

    @XmlElement
    @JsonProperty
    public String getContent() {
        return content;
    }
}
