package org.ivdnt.cf.rest.controllers;

import org.ivdnt.cf.GlobalConfigProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller // path relative to root?
public class ConfigController {
    final GlobalConfigProperties config;

    @Autowired
    public ConfigController(GlobalConfigProperties config) {
        this.config = config;
    }

    @GetMapping(path="/config", produces = { MediaType.APPLICATION_XML_VALUE, MediaType.APPLICATION_JSON_VALUE })
    @ResponseBody
    public Object getConfig() {
        return config;
    }
}
