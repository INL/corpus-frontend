package org.ivdnt.cf.rest.pojo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

/**
 * Wrapper object to allow us to return strings inside a json or xml structure
 * Jersey by default throws a fit if you return a String from a function that's supposed to return xml or json,
 * so we wrap it in one of these and it's happy (since it can serialize this).
 */
@JacksonXmlRootElement(localName="result")
public class GenericXmlJsonResult {
    @JsonProperty
    String content;

    public GenericXmlJsonResult(String content) {
        this.content = content;
    }

    @Override
    public String toString() {
        return content;
    }
}
