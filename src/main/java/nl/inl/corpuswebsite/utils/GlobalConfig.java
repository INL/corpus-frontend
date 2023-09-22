package nl.inl.corpuswebsite.utils;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.Arrays;
import java.util.Optional;
import java.util.Properties;

import javax.servlet.ServletContext;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.SystemUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * <pre>
 * Class to manage our global config file (default name: corpus-frontend.properties)
 * A default setup should *just work*, provided blacklab can be found on the same host at /blacklab-server/.
 *
 * Config files are loaded in the following order:
 * - Environment variables first (corpus frontend, then blacklab as fallback).
 * - Then /etc/corpus-frontend, then /etc/blacklab as fallback. (linux only)
 * - Then the directory containing the webapp, then the user's home directory.
 *
 * Configurations files are NOT case-sensitive.
 * Missing properties are logged and replaced with their default values.
 * Some properties may be normalized (e.g. trailing slashes are removed, or empty strings are replace by null).
 * </pre>
 */
public class GlobalConfig {
    private static final Logger logger = LoggerFactory.getLogger(GlobalConfig.class);

    public enum Keys {
        /**
         * Message to display at the top of the page. Note that this may contain HTML. https://github.com/INL/corpus-frontend/issues/247
         * NULL if not set.
         */
        PROP_BANNER_MESSAGE("bannerMessage"),
        /** Url to reach blacklab-server from this application. Never ends with a slash. */
        PROP_BLS_SERVERSIDE("blsUrl"),
        /** Url to reach blacklab-server from the browser. Never ends with a slash. */
        PROP_BLS_CLIENTSIDE("blsUrlExternal"),
        /** Where static content, custom xslt and other per-corpus data is stored. Never ends with a slash. */
        FRONTEND_CONFIG_PATH("corporaInterfaceDataDir"),
        /** Name of the default fallback directory/corpus in the PROP_DATA_PATH. Never ends with a slash. */
        FRONTEND_CONFIG_PATH_DEFAULT("corporaInterfaceDefault"),
        /**
         * Set the "withCredentials" option for all ajax requests made from the client to the (blacklab/frontend)-server.
         * Passes authentication cookies to blacklab-server.
         * This may be required if your server is configured to use authentication.
         * NOTE: this only works if the frontend and backend are hosted on the same domain, or when the server does not pass "*" for the Access-Control-Allow-Origin header.
         * (BlackLab does pass "*" by default, so you'll need a proxy to make this setup work).
         */
        FRONTEND_WITH_CREDENTIALS("withCredentials"),
        /** Development mode, allow script tags to load load js from an external server (webpack-dev-server), defaults to $pathToTop/js. Never ends in a slash. */
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
        set(defaultProps, Keys.PROP_BLS_CLIENTSIDE,             "/blacklab-server"); // no domain to account for proxied servers
        set(defaultProps, Keys.PROP_BLS_SERVERSIDE,             "http://localhost:8080/blacklab-server");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH,            SystemUtils.IS_OS_WINDOWS ? "C:\\etc\\blacklab\\projectconfigs" : "/etc/blacklab/projectconfigs");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH_DEFAULT,    "default");
        set(defaultProps, Keys.FRONTEND_SHOW_DEBUG_CHECKBOX,    "false");
        set(defaultProps, Keys.FRONTEND_WITH_CREDENTIALS,       "false");
        set(defaultProps, Keys.PROP_CACHE,                      "true");
        // jspath is initialized later, because we need the servlet context path for that.
    }

    static void set(Properties p, Keys k, String v) {
        p.setProperty(k.toString(), v);
    }

    static String get(Properties p, Keys k) {
        return p.getProperty(k.toString());
    }

    public String get(Keys k) {
        return get(instanceProps, k);
    }

    private void set(Keys k, String v) {
        set(instanceProps, k, v);
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
        } catch (IOException e) {
            throw new RuntimeException("Error reading global config file " + f, e);
        }

        this.validateAndNormalize();
    }

    private GlobalConfig(Properties props) {
        this.instanceProps = props;
        this.validateAndNormalize();
    }

    /**
     * Replace all properties with the properly capitalized versions
     * Warn about missing props.
     * Replace missing props with their defaults.
     */
    private void validateAndNormalize() {
        for (String key : instanceProps.stringPropertyNames()) {
            final String currentKey = key;
            final String value = instanceProps.getProperty(key);

            Keys foundKey = Arrays
                    .stream(Keys.values())
                    .filter(k -> k.toString().equalsIgnoreCase(currentKey))
                    .findFirst()
                    .orElse(null);
            if (foundKey == null) continue; // property does not map to a known key, ignore it

            // replace with the properly capitalized version
            instanceProps.remove(key); // this is okay, stringPropertyNames() returns a copy of the keys
            instanceProps.setProperty(foundKey.toString(), value);
        }

        // Now check for missing props, warn and set defaults
        for (String defaultPropName : defaultProps.stringPropertyNames()) {
            String defaultPropValue = defaultProps.getProperty(defaultPropName);
            if (!instanceProps.containsKey(defaultPropName) && defaultPropValue != null) {
                logger.info("Config setting {} not configured, using default: {}", defaultPropName, defaultPropValue);
                instanceProps.setProperty(defaultPropName, defaultPropValue);
            }
        }

        // perform some final checks, such as removing any trailing slash (just to be consistent)
        if (StringUtils.trimToNull(get(Keys.PROP_BANNER_MESSAGE)) == null) instanceProps.remove(Keys.PROP_BANNER_MESSAGE.s);
        set(Keys.PROP_BLS_SERVERSIDE, StringUtils.stripEnd(get(Keys.PROP_BLS_SERVERSIDE), "/\\"));
        set(Keys.PROP_BLS_CLIENTSIDE, StringUtils.stripEnd(get(Keys.PROP_BLS_CLIENTSIDE), "/\\"));
        set(Keys.FRONTEND_CONFIG_PATH, StringUtils.stripEnd(get(Keys.FRONTEND_CONFIG_PATH), "/\\"));
        set(Keys.FRONTEND_CONFIG_PATH_DEFAULT, StringUtils.stripEnd(get(Keys.FRONTEND_CONFIG_PATH_DEFAULT), "/\\"));
        set(Keys.PROP_JSPATH, StringUtils.stripEnd(get(Keys.PROP_JSPATH), "/\\"));
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
