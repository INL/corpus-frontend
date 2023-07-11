package org.ivdnt.cf;

import org.apache.commons.lang.SystemUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.Properties;

public class GlobalConfig {
    private static final Logger logger = LoggerFactory.getLogger(GlobalConfig.class);
    public enum Keys {
        PROP_BANNER_MESSAGE("bannerMessage"),
        PROP_BLS_CLIENTSIDE("blsUrl"),
        PROP_BLS_SERVERSIDE("blsUrlExternal"),
        // todo rename to PROP_CORPUS_CONFIGS_PATH,
        FRONTEND_CONFIG_PATH("corporaInterfaceDataDir"),
        // todo rename to PROP_CORPUS_CONFIGS_DEFAULT,
        FRONTEND_CONFIG_PATH_DEFAULT("corporaInterfaceDefault"),

        // no longer required for this part of the application
//        PROP_JSPATH,

        // no longer required, we can just use a file watcher when required?
//        PROP_CACHE,
        // not a fan of this one, but keep it around for now.
        PROP_DEBUG_CHECKBOX_VISIBLE("debugInfo")
        ;
        public final String s;
        Keys(String s) {
            this.s = s;
        }
        public String toString() {
            return s;
        }
    }

    private static final Properties defaultProps = new Properties();
    private Properties instanceProps;
    static {
        set(defaultProps, Keys.PROP_BLS_CLIENTSIDE,          "/blacklab-server"); // no domain to account for proxied servers
        set(defaultProps, Keys.PROP_BLS_SERVERSIDE,          "http://localhost:8080/blacklab-server/");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH,         SystemUtils.IS_OS_WINDOWS ? "C:\\etc\\blacklab\\projectconfigs" : "/etc/blacklab/projectconfigs");
        set(defaultProps, Keys.FRONTEND_CONFIG_PATH_DEFAULT, "default");
        set(defaultProps, Keys.PROP_DEBUG_CHECKBOX_VISIBLE,  "false");
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

    public GlobalConfig(File f) {
        if (!f.isFile())
            throw new IllegalArgumentException("File " + f + " does not exist");
        if (!f.canRead())
            throw new IllegalArgumentException("File" + f + " is not readable");

        this.instanceProps = new Properties(defaultProps);
        try (Reader in = new BufferedReader(new FileReader(f))) {
            logger.info("Reading global config: {}", f);
            this.instanceProps.load(in);
        } catch (IOException e) {
            throw new IllegalArgumentException("File " + f + " does not exist");
        }

        for (String defaultProp : defaultProps.stringPropertyNames()) {
            if (!instanceProps.containsKey(defaultProp))
                logger.debug("Annotation {} not configured, using default: {}", defaultProp, defaultProps.getProperty(defaultProp));
        }
    }

    private GlobalConfig(Properties props) {
        this.instanceProps = defaultProps;
    }

    public static GlobalConfig getDefault() {
        return new GlobalConfig(defaultProps);
    }
}
