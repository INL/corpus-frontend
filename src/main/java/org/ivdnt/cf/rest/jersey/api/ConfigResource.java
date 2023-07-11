package org.ivdnt.cf.rest.jersey.api;

import org.glassfish.jersey.server.JSONP;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.rest.jersey.pojo.GlobalConfigRepresentation;

import javax.inject.Singleton;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

@Singleton
@Path("api/config/")
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
