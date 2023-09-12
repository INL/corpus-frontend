package org.ivdnt.cf.rest.controllers;

import org.ivdnt.cf.GlobalConfigProperties;
import org.ivdnt.cf.rest.pojo.GenericXmlJsonResult;
import org.ivdnt.cf.rest.pojo.GlobalConfigRepresentation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller("/api/")
//@CrossOrigin(origins = "http://localhost:5173")
public class ApiController {
    final GlobalConfigProperties config;

    @Autowired
    public ApiController(GlobalConfigProperties config) {
        this.config = config;
    }

    @GetMapping(path="/config", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object getConfig() {
        return new GlobalConfigRepresentation(config);
    }

    @GetMapping(path="/config/{corpus}", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object getCorpusConfig(@PathVariable String corpus) {
        return new GenericXmlJsonResult("todo" + corpus);
    }

    @GetMapping(path="/test", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object helloWorld(Authentication userPrincipal) {
        return userPrincipal != null ? userPrincipal : new GenericXmlJsonResult("Anonymously did request");
//        return new GenericXmlJsonResult("hello-world. User is: " + (userPrincipal == null ? "anonymous" : userPrincipal.getName()));
    }
}
