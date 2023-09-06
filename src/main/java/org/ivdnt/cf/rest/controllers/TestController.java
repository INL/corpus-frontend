package org.ivdnt.cf.rest.controllers;

import org.ivdnt.cf.rest.pojo.GenericXmlJsonResult;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
//@CrossOrigin(origins = "http://localhost:5173")
public class TestController {
    @GetMapping(path="/api/test", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object helloWorld(Authentication userPrincipal) {
        return userPrincipal != null ? userPrincipal : new GenericXmlJsonResult("Anonymously did request");
//        return new GenericXmlJsonResult("hello-world. User is: " + (userPrincipal == null ? "anonymous" : userPrincipal.getName()));
    }

    @GetMapping(path="/api/test2", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object helloWorld2(Authentication userPrincipal) {
        userPrincipal.getPrincipal();
        return userPrincipal != null ? userPrincipal : new GenericXmlJsonResult("Anonymously did request");
//        return new GenericXmlJsonResult("hello-world. User is: " + (userPrincipal == null ? "anonymous" : userPrincipal.getName()));
    }
}
