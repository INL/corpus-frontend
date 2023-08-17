package org.ivdnt.cf.rest;

import com.fasterxml.jackson.core.util.JacksonFeature;
import jakarta.servlet.ServletContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.ext.Provider;
import org.apache.commons.lang3.SystemUtils;
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

import java.io.File;
import java.util.Optional;

@Provider
public class Setup extends ResourceConfig {
    private static final Logger logger = LoggerFactory.getLogger(Setup.class);

    public Setup(@Context ServletContext context) {
        super(
            // Enable gzip compression
            EncodingFilter.class,
            GZipEncoder.class,
            DeflateEncoder.class,

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

        GlobalConfig cfg = loadGlobalConfig(context);

        property(cfg.getClass().getName(), cfg);
    }


    /**
     * Config file resolution order:
     * Environment variables first (corpus frontend, then blacklab as fallback).
     * Then /etc/corpus-frontend, then /etc/blacklab as fallback.
     * Then the directory containing the webapp, then the user's home directory.
     *
     * @param ctx ServletContext
     * @return GlobalConfig, with default settings if none was found
     */
    protected static GlobalConfig loadGlobalConfig(ServletContext ctx) {
        final String applicationName = ctx.getContextPath().replaceAll("^/", "");
        final String configFileName = applicationName + ".properties";
        Optional<GlobalConfig> config = tryLoadConfig(System.getenv("CORPUS_FRONTEND_CONFIG_DIR"), configFileName)
                .or(() -> tryLoadConfig(System.getenv("AUTOSEARCH_CONFIG_DIR"), configFileName))
                .or(() -> tryLoadConfig(System.getenv("BLACKLAB_CONFIG_DIR"), configFileName));
        if (SystemUtils.IS_OS_LINUX) {
            config = config
                .or(() -> tryLoadConfig("/etc/" + applicationName + "/", configFileName))
                .or(() -> tryLoadConfig("/etc/blacklab/", configFileName));
        }
        return config
            .or(() -> tryLoadConfig(new File(ctx.getRealPath("/")).getParentFile().getPath(), configFileName))
            .or(() -> tryLoadConfig(System.getProperty("user.home"), configFileName)) // user.home works on both linux and windows.
            .orElseGet(GlobalConfig::getDefault);
    }

    private static Optional<GlobalConfig> tryLoadConfig(String path, String filename) {
        return Optional.ofNullable(path)
            .map(File::new)
            .filter(File::isDirectory)
            .map(f -> new File(f, filename))
            .filter(f -> {
                if (!f.canRead()) logger.debug("Config file not found at {}", f.getAbsolutePath());
                return f.canRead();
            })
            .map(f -> {
                try {
                    GlobalConfig conf = new GlobalConfig(f);
                    logger.info("Loaded config file at {}", f.getAbsolutePath());
                    return conf;
                } catch (Exception e) {
                    logger.error("Error occurred while reading config file at " + f.getAbsolutePath(), e);
                    return null;
                }
            });
    }
}
