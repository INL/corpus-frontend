package org.ivdnt.cf.rest;

import com.fasterxml.jackson.core.util.JacksonFeature;
import jakarta.servlet.ServletContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.ext.Provider;

import org.glassfish.jersey.jaxb.internal.JaxbAutoDiscoverable;
import org.glassfish.jersey.message.DeflateEncoder;
import org.glassfish.jersey.message.GZipEncoder;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.filter.EncodingFilter;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.rest.api.ConfigResource;
import org.ivdnt.cf.rest.api.XsltResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Provider
public class Setup extends ResourceConfig {
    private static final Logger logger = LoggerFactory.getLogger(Setup.class);

    public Setup(@Context ServletContext context) {
        super(
            // Enable gzip compression
            EncodingFilter.class,
            GZipEncoder.class,
            DeflateEncoder.class,

            // Enable JWT, OIDC, and Keycloak
            KeycloakFilter.class,

            // Should be automatically picked up, but isn't, so register it manually.
            // this registers all JAXB classes with Jersey, allowing us to produce/consume XML.
            JaxbAutoDiscoverable.class,
            // Same deal for jackson, only this does JSON, not XML.
            JacksonFeature.class,

            // Some stuff of our own, like mappping exceptions to HTTP status codes and respons bodies
            GenericExceptionMapper.class,
            // enable CORS
            CORSFilter.class,
            // this maps &outputtype query param to Accept header, for easy content negotiation when manually testing
            OutputTypeFilter.class,

            // Register our api endpoints and pages
            ConfigResource.class,
            XsltResource.class
        );

        GlobalConfig cfg = GlobalConfig.loadGlobalConfig(context);

        property(cfg.getClass().getName(), cfg);
    }
}
