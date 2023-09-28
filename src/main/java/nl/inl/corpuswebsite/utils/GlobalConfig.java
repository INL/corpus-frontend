package nl.inl.corpuswebsite.utils;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.Arrays;
import java.util.Optional;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.SystemUtils;

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
    private static final Logger logger = Logger.getLogger(GlobalConfig.class.getName());

    public enum Keys {
        /**
         * Message to display at the top of the page. Note that this may contain HTML. https://github.com/INL/corpus-frontend/issues/247
         * NULL if not set.
         */
        BANNER_MESSAGE("bannerMessage"),
        /** Url to reach blacklab-server from this application. Never ends with a slash. */
        BLS_URL_ON_SERVER("blsUrl"),
        /** Url to reach blacklab-server from the browser. Never ends with a slash. */
        BLS_URL_ON_CLIENT("blsUrlExternal"),
        /** Where static content, custom xslt and other per-corpus data is stored. Never ends with a slash. */
        CORPUS_CONFIG_DIR("corporaInterfaceDataDir"),
        /** Name of the default fallback directory/corpus in the PROP_DATA_PATH. Never ends with a slash. */
        DEFAULT_CORPUS_CONFIG("corporaInterfaceDefault"),
        /**
         * Set the "withCredentials" option for all ajax requests made from the client to the (blacklab/frontend)-server.
         * Passes authentication cookies to blacklab-server.
         * This may be required if your server is configured to use authentication.
         * NOTE: this only works if the frontend and backend are hosted on the same domain, or when the server does not pass "*" for the Access-Control-Allow-Origin header.
         * (BlackLab does pass "*" by default, so you'll need a proxy to make this setup work).
         */
        FRONTEND_WITH_CREDENTIALS("withCredentials"),
        /** Development mode, allow script tags to load load js from an external server (webpack-dev-server), defaults to $pathToTop/js. Never ends in a slash. */
        JSPATH("jspath"),
        // todo remove and use a file watcher or something
        /** Development mode, disable caching of any corpus data (e.g. search.xml, article.xsl, meta.xsl etc) */
        CACHE("cache"),
        /** Enable/disable the debug info checkbox in the interface */
        SHOW_DEBUG_CHECKBOX_ON_CLIENT("debugInfo"),
        /**
         * Url to reach the corpus-frontend servlet (i.e. this) from the browser. Never ends with a slash. Usually not required, but might be necessary when server is behind a proxy.
         * Never ends in a slash.
         */
        CF_URL_ON_CLIENT("cfUrlExternal");

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
        set(defaultProps, Keys.BLS_URL_ON_CLIENT,               "/blacklab-server"); // no domain to account for proxied servers
        set(defaultProps, Keys.BLS_URL_ON_SERVER,               "http://localhost:8080/blacklab-server");
        set(defaultProps, Keys.CORPUS_CONFIG_DIR,               SystemUtils.IS_OS_WINDOWS ? "C:\\etc\\blacklab\\projectconfigs" : "/etc/blacklab/projectconfigs");
        set(defaultProps, Keys.DEFAULT_CORPUS_CONFIG,           "default");
        set(defaultProps, Keys.SHOW_DEBUG_CHECKBOX_ON_CLIENT,    "false");
        set(defaultProps, Keys.FRONTEND_WITH_CREDENTIALS,       "false");
        set(defaultProps, Keys.CACHE,                           "true");
        // jspath and cfUrlExternal initialized later, because we need the servlet context path for that.
    }

    private GlobalConfig(File f) {
        this(loadProperties(f));
    }

    private GlobalConfig(Properties props) {
        this.instanceProps = props;
        this.validateAndNormalize();
    }

    public String get(Keys k) {
        return get(instanceProps, k);
    }

    private static String get(Properties p, Keys k) {
        return p.getProperty(k.toString());
    }

    private static void set(Properties p, Keys k, String v) {
        p.setProperty(k.toString(), v);
    }

    private void set(Keys k, String v) {
        set(instanceProps, k, v);
    }

    /**
     * To be called before finishing initialization.
     *
     * Replace all properties with the properly capitalized versions.
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
                logger.info(String.format("Config setting not found '%s' : using default value '%s'", defaultPropName, defaultPropValue));
                instanceProps.setProperty(defaultPropName, defaultPropValue);
            }
        }

        // perform some final checks, such as removing any trailing slash (just to be consistent)
        if (StringUtils.trimToNull(get(Keys.BANNER_MESSAGE)) == null) instanceProps.remove(Keys.BANNER_MESSAGE.s);
        set(Keys.BLS_URL_ON_SERVER, StringUtils.stripEnd(get(Keys.BLS_URL_ON_SERVER), "/\\"));
        set(Keys.BLS_URL_ON_CLIENT, StringUtils.stripEnd(get(Keys.BLS_URL_ON_CLIENT), "/\\"));
        set(Keys.CORPUS_CONFIG_DIR, StringUtils.stripEnd(get(Keys.CORPUS_CONFIG_DIR), "/\\"));
        set(Keys.DEFAULT_CORPUS_CONFIG, StringUtils.stripEnd(get(Keys.DEFAULT_CORPUS_CONFIG), "/\\"));
        set(Keys.JSPATH, StringUtils.stripEnd(get(Keys.JSPATH), "/\\"));
        set(Keys.CF_URL_ON_CLIENT, StringUtils.stripEnd(get(Keys.CF_URL_ON_CLIENT), "/\\"));
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
        final String applicationName = ctx.getContextPath().replaceAll("^/", "");
        final String configFileName = applicationName + ".properties";

        set(defaultProps, Keys.CF_URL_ON_CLIENT, "/" + applicationName);
        set(defaultProps, Keys.JSPATH, get(defaultProps, Keys.CF_URL_ON_CLIENT) + "/js");

        Optional<GlobalConfig> config = tryLoadConfigEnv("CORPUS_FRONTEND_CONFIG_DIR", configFileName)
                .or(() -> tryLoadConfigEnv("AUTOSEARCH_CONFIG_DIR", configFileName))
                .or(() -> tryLoadConfigEnv("BLACKLAB_CONFIG_DIR", configFileName));
        if (SystemUtils.IS_OS_UNIX) {
            config = config
                    .or(() -> tryLoadConfigPath("/etc/" + applicationName + "/", configFileName))
                    .or(() -> tryLoadConfigPath("/etc/blacklab/", configFileName))
                    .or(() -> tryLoadConfigPath("/vol1/etc/blacklab", configFileName)); // mirror blacklab locations.
        }
        return config
                .or(() -> tryLoadConfigPath(new File(ctx.getRealPath("/")).getParentFile().getPath(), configFileName))
                .or(() -> tryLoadConfigPath(System.getProperty("user.home"), configFileName)) // user.home works on both linux and windows.
                .orElseGet(GlobalConfig::getDefault);
    }

    private static Optional<GlobalConfig> tryLoadConfigEnv(String envName, String filename) {
        String path = System.getenv(envName);
        if (path == null) {
            logger.fine("Config from env '" + envName + "': not set - ignoring.");
            return Optional.empty();
        }
        logger.fine("Config from env '" + envName + "': " + path);
        return tryLoadConfigPath(path, filename);
    }

    private static Optional<GlobalConfig> tryLoadConfigPath(String path, String filename) {
        return Optional.of(path)
                .map(File::new)
                .map(f -> new File(f, filename))
                .filter(f -> {
                    if (!f.canRead()) logger.fine(String.format("Config from file '%s': does not exist/can't read - ignoring", f.getAbsolutePath()));
                    return f.canRead();
                })
                .map(f -> {
                    try {
                        return new GlobalConfig(f);
                    } catch (Exception e) {
                        logger.log(Level.WARNING, String.format("Config file from '%s': ERROR", f.getAbsolutePath()), e);
                        return null;
                    }
                });
    }

    private static Properties loadProperties(File f) {
        if (!f.isFile())
            throw new IllegalArgumentException("File " + f + " does not exist");
        if (!f.canRead())
            throw new IllegalArgumentException("File" + f + " is not readable");

        // don't pass defaults, we set those manually later, so we can log which ones are used
        Properties loadedProps = new Properties();
        try (Reader in = new BufferedReader(new FileReader(f))) {
            logger.info(String.format("Reading global config: %s", f));
            loadedProps.load(in);
        } catch (IOException e) {
            throw new RuntimeException("Error reading global config file " + f, e);
        }
        return loadedProps;
    }

}
