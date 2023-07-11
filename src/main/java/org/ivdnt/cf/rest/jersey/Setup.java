package org.ivdnt.cf.rest.jersey;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsonorg.JsonOrgModule;
import com.fasterxml.jackson.jaxrs.json.JacksonJaxbJsonProvider;
import com.fasterxml.jackson.jaxrs.json.JsonMapperConfigurator;
import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.message.DeflateEncoder;
import org.glassfish.jersey.message.GZipEncoder;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.filter.EncodingFilter;
import org.ivdnt.cf.GlobalConfig;
import org.ivdnt.cf.rest.jersey.api.ConfigResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletContext;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.UriInfo;
import javax.ws.rs.ext.ContextResolver;
import java.io.File;

public class Setup extends ResourceConfig {
    private static final Logger logger = LoggerFactory.getLogger(Setup.class);


    public static String KEY_GLOBAL_CONFIG = "org.ivdnt.cf.config";

    /**
     * ObjectMapper is used by Jackson to determine how to serialize objects to/from xml/json.
     * Jackson is responsible for generating xml/json content-types in Jersey,
     * however, by default Jersey uses a default ObjectMapper instance to do so, and it doesn't support JSONObject/JSONArray.
     * Jersey allows us to register a custom factory/provider-type class to dynamically provide the ObjectMapper used by Jersey.
     * So do that with this class, and return one that does support converting JSONObject/JSONarray.
     */
    private static class ObjectMapperContextResolver implements ContextResolver<ObjectMapper> {
        private final ObjectMapper mapper;

        @SuppressWarnings("unused") // Is only called through reflection
        public ObjectMapperContextResolver() {
            // By default Jackson ignores Jaxb annotations, causing annotations like @XmlAccessorType to not work
            // So we need to explicitly enable the annotations again
            mapper = new JsonMapperConfigurator(null, JacksonJaxbJsonProvider.DEFAULT_ANNOTATIONS).getDefaultMapper();

            // Enable the mapper to serialize JSONObject/JSONArray
            mapper.registerModule(new JsonOrgModule());

            // TODO copied from VWS, but remove this if we don't end up using it, we don't do field filtering on json responses in this application
            // Add some mixins, allowing us to annotate classes with Jackson annotations without modifying the original class.
            // See JsonMediaInterceptor
//            mapper.addMixIn(Object.class, JsonFieldFilterMixin.class);
        }

        @Override
        public ObjectMapper getContext(Class<?> type) {
            return mapper;
        }
    }

    public Setup(@Context ServletContext context, @Context UriInfo uriInfo) {
        super(
            // Enable gzip compression
            EncodingFilter.class,
            GZipEncoder.class,
            DeflateEncoder.class,

            JacksonFeature.class, // Enable Jackson as our JAXB provider

            // Preprocess data in api responses and map exceptions in api to proper pages/messages
            ObjectMapperContextResolver.class,
            GenericExceptionMapper.class,
            CORSFilter.class,

            // Register our api endpoints and pages
            ConfigResource.class
//            XsltResource.class,


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

        GlobalConfig cfg = loadGlobalConfig(context);

        property(cfg.getClass().getName(), cfg);
    }

    protected static GlobalConfig loadGlobalConfig(ServletContext ctx) {
        final String applicationName = ctx.getContextPath().replaceAll("^/", "");
        final String configFileName = applicationName + ".properties";

        env1:
        {
            String s = System.getenv("CORPUS_FRONTEND_CONFIG_DIR");
            if (s == null) {
                logger.debug("Environment variable CORPUS_FRONTEND_CONFIG_DIR not set");
                break env1;
            }
            File f = new File(s, configFileName);
            try {
                return new GlobalConfig(f);
            } catch (Exception e) {
                logger.error("Error while reading config file {}", f.getAbsolutePath(), e);
                break env1;
            }
        }
        env2:
        {
            String s = System.getenv("AUTOSEARCH_CONFIG_DIR");
            if (s == null) {
                logger.debug("Environment variable CORPUS_FRONTEND_CONFIG_DIR not set");
                break env2;
            }
            File f = new File(s, configFileName);
            try {
                return new GlobalConfig(f);
            } catch (Exception e) {
                logger.error("Error while reading config file {}", f.getAbsolutePath(), e);
                break env2;
            }
        }
        warpath:
        {
            String warPath = ctx.getRealPath("/");
            if (warPath != null) {
                File f = new File(new File(warPath).getParentFile(), configFileName);
                try {
                    return new GlobalConfig(f);
                } catch (Exception e) {
                    logger.error("Error while reading config file {}", f.getAbsolutePath(), e);
                    break warpath;
                }
            }
        }

        return GlobalConfig.getDefault();
    }
}
