package org.ivdnt.cf.rest.api;

import org.glassfish.jersey.server.JSONP;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.rest.pojo.GlobalConfigRepresentation;

import jakarta.inject.Singleton;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;

@Singleton
@Path("/config/") // path is relative to Jersey root (see web.xml filter "jersey"), currently /api/* (so this is /api/config)
public class ConfigResource {
    final GlobalConfig config;
    public ConfigResource(@Context Application app) {
        config = (GlobalConfig) app.getProperties().get(GlobalConfig.class.getName());
    }

    @GET
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    @JSONP(queryParam = "callback")
    public Object getConfig() {
        return new GlobalConfigRepresentation(config);
    }
}
