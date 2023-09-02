package org.ivdnt.cf;

import org.apache.commons.lang3.SystemUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;


// https://docs.spring.io/spring-boot/docs/3.1.3/reference/htmlsingle/#features.external-config.typesafe-configuration-properties

// https://docs.spring.io/spring-boot/docs/3.1.3/reference/htmlsingle/#features.external-config.typesafe-configuration-properties.java-bean-binding
@Component
@ConfigurationProperties(/*prefix = "cf"*/) // don't do any prefix for now - backwards compatibility
public class GlobalConfigProperties {
    private static final Logger logger = LoggerFactory.getLogger(GlobalConfigProperties.class);

    private String bannerMessage;
    private String blsUrl;
    private String blsUrlExternal;
    private String corporaInterfaceDataDir = "";
    private String corporaInterfaceDefault;
    private String jspath;
    private boolean cache;
    private boolean withCredentials;
    private boolean debugInfo;

    public GlobalConfigProperties() {
        logger.info("GlobalConfigProperties constructor");
        this.bannerMessage = "";
        this.blsUrl = "/blacklab-server";
        this.blsUrlExternal = "/blacklab-server";
        this.corporaInterfaceDataDir = SystemUtils.IS_OS_WINDOWS ? "C:\\etc\\blacklab\\projectconfigs" : "/etc/blacklab/projectconfigs";
        this.corporaInterfaceDefault = "default";
        this.jspath = "/js";
        this.cache = false;
        this.withCredentials = false;
        this.debugInfo = false;
    }

    public String getBannerMessage() {
        return bannerMessage;
    }

    public void setBannerMessage(String bannerMessage) {
        this.bannerMessage = bannerMessage;
    }

    public String getBlsUrl() {
        return blsUrl;
    }

    public void setBlsUrl(String blsUrl) {
        this.blsUrl = blsUrl;
    }

    public String getBlsUrlExternal() {
        return blsUrlExternal;
    }

    public void setBlsUrlExternal(String blsUrlExternal) {
        this.blsUrlExternal = blsUrlExternal;
    }

    public String getCorporaInterfaceDataDir() {
        return corporaInterfaceDataDir;
    }

    public void setCorporaInterfaceDataDir(String corporaInterfaceDataDir) {
        this.corporaInterfaceDataDir = corporaInterfaceDataDir;
    }

    public String getCorporaInterfaceDefault() {
        return corporaInterfaceDefault;
    }

    public void setCorporaInterfaceDefault(String corporaInterfaceDefault) {
        this.corporaInterfaceDefault = corporaInterfaceDefault;
    }

    public String getJspath() {
        return jspath;
    }

    public void setJspath(String jspath) {
        this.jspath = jspath;
    }

    public boolean getCache() {
        return cache;
    }

    public void setCache(boolean cache) {
        this.cache = cache;
    }

    public boolean getWithCredentials() {
        return withCredentials;
    }

    public void setWithCredentials(boolean withCredentials) {
        this.withCredentials = withCredentials;
    }

    public boolean getDebugInfo() {
        return debugInfo;
    }

    public void setDebugInfo(boolean debugInfo) {
        this.debugInfo = debugInfo;
    }

}
