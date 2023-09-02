package org.ivdnt.cf.rest.controllers;

import org.ivdnt.cf.rest.pojo.GenericXmlJsonResult;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@CrossOrigin(origins = "*")
public class HelloWorldController {
    @GetMapping(path="/hello", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object helloWorld() {
        return new GenericXmlJsonResult("hello-world"); // Returns the name of the HTML template (hello-world.html)
    }
}
