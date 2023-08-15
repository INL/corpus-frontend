package org.ivdnt.cf.rest;

import com.fasterxml.jackson.core.util.JacksonFeature;
import jakarta.servlet.ServletContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.ext.Provider;
import org.apache.commons.lang3.SystemUtils;
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

    /**
     * ObjectMapper is used by Jackson to determine how to serialize objects to/from xml/json.
     * Jackson is responsible for generating xml/json content-types in Jersey,
     * however, by default Jersey uses a default ObjectMapper instance to do so, and it doesn't support JSONObject/JSONArray.
     * Jersey allows us to register a custom factory/provider-type class to dynamically provide the ObjectMapper used by Jersey.
     * So do that with this class, and return one that does support converting JSONObject/JSONarray.
     */
//    private static class ObjectMapperContextResolver implements ContextResolver<ObjectMapper> {
//        private final ObjectMapper mapper;
//
//        @SuppressWarnings("unused") // Is only called through reflection
//        public ObjectMapperContextResolver() {
//            // By default Jackson ignores Jaxb annotations, causing annotations like @XmlAccessorType to not work
//            // So we need to explicitly enable the annotations again
//            mapper = new JsonMapperConfigurator(null, JacksonJaxbJsonProvider.DEFAULT_ANNOTATIONS).getDefaultMapper();
//
//            // Enable the mapper to serialize JSONObject/JSONArray
////            mapper.registerModule(new JsonOrgModule());
//
//            // TODO copied from VWS, but remove this if we don't end up using it, we don't do field filtering on json responses in this application
//            // Add some mixins, allowing us to annotate classes with Jackson annotations without modifying the original class.
//            // See JsonMediaInterceptor
////            mapper.addMixIn(Object.class, JsonFieldFilterMixin.class);
//        }
//
//        @Override
//        public ObjectMapper getContext(Class<?> type) {
//            return mapper;
//        }
//    }

    public Setup(@Context ServletContext context) {
        super(
            // Enable gzip compression
            EncodingFilter.class,
            GZipEncoder.class,
            DeflateEncoder.class,

            org.glassfish.jersey.jaxb.internal.JaxbAutoDiscoverable.class,

            // Preprocess data in api responses and map exceptions in api to proper pages/messages

            JacksonFeature.class, // register jackson into jersey (enable json/xml support)


//            ObjectMapperContextResolver.class,
            GenericExceptionMapper.class,
            CORSFilter.class,
            OutputTypeFilter.class,

            // Register our api endpoints and pages
            ConfigResource.class,
            XsltResource.class


//            LemmaResource.class,
//            DictionaryResource.class,
//            LanguageResource.class,
//            CountryResource.class,
//
//            IndexPage.class,
//            HelpPage.class,
//            SearchPage.class,
//            ResultsPage.class
        );


//        System.out.println("INIT SETUP\n\n\n\n\n\n\n\n\n\n\n\n\n\n");


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
