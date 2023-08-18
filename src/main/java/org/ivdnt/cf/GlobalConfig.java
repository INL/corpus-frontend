package org.ivdnt.cf;

import org.apache.commons.lang3.SystemUtils;
import org.ivdnt.cf.rest.Setup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.Optional;
import java.util.Properties;

import jakarta.servlet.ServletContext;

public class GlobalConfig {
    private static final Logger logger = LoggerFactory.getLogger(GlobalConfig.class);

    public enum Keys {
        /** Message to display at the top of the page. Note that this may contain HTML. https://github.com/INL/corpus-frontend/issues/247 */
        PROP_BANNER_MESSAGE("bannerMessage"),
        /** Url to reach blacklab-server from this application */
        PROP_BLS_SERVERSIDE("blsUrl"),
        /** Url to reach blacklab-server from the browser */
        PROP_BLS_CLIENTSIDE("blsUrlExternal"),
        /** Where static content, custom xslt and other per-corpus data is stored */
        FRONTEND_CONFIG_PATH("corporaInterfaceDataDir"),
        /** Name of the default fallback directory/corpus in the PROP_DATA_PATH */
        FRONTEND_CONFIG_PATH_DEFAULT("corporaInterfaceDefault"),
        /** Development mode, allow script tags to load load js from an external server (webpack-dev-server), defaults to $pathToTop/js/ */
        PROP_JSPATH("jspath"),
        // todo remove and use a file watcher or something
        /** Development mode, disable caching of any corpus data (e.g. search.xml, article.xsl, meta.xsl etc) */
        PROP_CACHE("cache"),
        /** Enable/disable the debug info checkbox in the interface */
        FRONTEND_SHOW_DEBUG_CHECKBOX("debugInfo");

        public final String s;
        Keys(String s) {
            this.s = s;
        }
        public String toString() {
            return s;
        }
    }

    private static final Properties defaultProps = new Properties();
    private final Properties instanceProps;
    static {
        // Keep these in sync with what we document as defaults in README.md
        set(defaultProps, Keys.PROP_BLS_CLIENTSIDE,             "/blacklab-server/"); // no domain to account for proxied servers
        set(defaultProps, Keys.PROP_BLS_SERVERSIDE,             "http://localhost:8080/blacklab-server/");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH,            SystemUtils.IS_OS_WINDOWS ? "C:\\etc\\blacklab\\projectconfigs" : "/etc/blacklab/projectconfigs");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH_DEFAULT,    "default");
        set(defaultProps, Keys.FRONTEND_SHOW_DEBUG_CHECKBOX,    "false");
        set(defaultProps, Keys.PROP_CACHE,                      "true");
        // jspath is initialized later, because we need the servlet context path for that.
    }

    static void set(Properties p, Keys k, String v) {
        p.setProperty(k.toString().toLowerCase(), v);
    }

    static String get(Properties p, Keys k) {
        return p.getProperty(k.toString().toLowerCase());
    }

    public String get(Keys k) {
        return get(instanceProps, k);
    }

    public GlobalConfig() {
        this.instanceProps = new Properties(defaultProps);
    }

    public GlobalConfig(File f) {
        if (!f.isFile())
            throw new IllegalArgumentException("File " + f + " does not exist");
        if (!f.canRead())
            throw new IllegalArgumentException("File" + f + " is not readable");

        // don't pass defaults, we set those manually later, so we can log which ones are used
        this.instanceProps = new Properties();
        try (Reader in = new BufferedReader(new FileReader(f))) {
            logger.debug("Reading global config: {}", f);
            this.instanceProps.load(in);
            // lowercase them
            for (String key : instanceProps.stringPropertyNames()) {
                String value = instanceProps.getProperty(key);
                instanceProps.remove(key);
                instanceProps.setProperty(key.toLowerCase(), value);
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("File " + f + " does not exist");
        }

        for (String defaultProp : defaultProps.stringPropertyNames()) {
            defaultProp = defaultProp.toLowerCase();
            if (!instanceProps.containsKey(defaultProp))
                logger.info("Config setting {} not configured, using default: {}", defaultProp, defaultProps.getProperty(defaultProp));
        }
    }

    private GlobalConfig(Properties props) {
        this.instanceProps = defaultProps;
    }

    public static GlobalConfig getDefault() {
        return new GlobalConfig(defaultProps);
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
    public static GlobalConfig loadGlobalConfig(ServletContext ctx) {
        set(defaultProps, Keys.PROP_JSPATH, ctx.getContextPath() + "/js");

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
