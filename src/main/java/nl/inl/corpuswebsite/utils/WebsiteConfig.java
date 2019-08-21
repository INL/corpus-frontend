package nl.inl.corpuswebsite.utils;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import nl.inl.corpuswebsite.MainServlet;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.builder.ConfigurationBuilder;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.builder.fluent.Parameters;
import org.apache.commons.configuration2.convert.DisabledListDelimiterHandler;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.interpol.ConfigurationInterpolator;
import org.apache.commons.configuration2.interpol.Lookup;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang.StringUtils;

/**
 * Configuration read from an XML config file.
 */
public class WebsiteConfig {

    /** One of the links shown in the top bar */
    public static class LinkInTopBar {
        private final String label;
        private final String href;
        private final boolean openInNewWindow;

        /**
         *
         * @param label display text
         * @param href address of the link, this should be an absolute path
         * @param openInNewWindow
         * @param relative does the url point within our own web application (e.g. starts with our context path)
         *        We need to track this to know if we should make this link relative to the current page, or whether it's an
         *        absolute url
         */
        public LinkInTopBar(String label, String href, boolean openInNewWindow) {
            super();
            this.label = label;
            this.href = href;
            this.openInNewWindow = openInNewWindow;
        }

        // Getters required for velicity
        public String getLabel() {
            return label;
        }

        public String getHref() {
            return href;
        }

        public boolean isOpenInNewWindow() {
            return openInNewWindow;
        }

        @Override
        public String toString() {
            return label;
        }
    }

    /** Raw id of this corpus, including username if this is a user corpus. Null if no corpus set. */
    private String corpusId;

    /**
     * Name to display for this corpus, null if no corpus set. Falls back to the corpus name if not explicitly configured.
     */
    private String corpusDisplayName;

    /** User for this corpus, null if no corpus set or this corpus has no owner. */
    private String corpusOwner;

    /** Custom css to use */
    private String pathToCustomCss;

    /** Custom js to use */
    private String pathToCustomJs;

    /** Should be a directory */
    private String pathToFaviconDir;

    /** properties to show in result columns, empty string if no corpus set or not configured for this corpus */
    private String propColumns = "";

    /** Allow suppressing pagination on the article page. This causes the article xslt to receive the full document instead of only a snippet */
    private boolean pagination = true;

    /** Google analytics key, analytics are disabled if not provided */
    private String analyticsKey;

    /** Link to put in the top bar */
    private List<LinkInTopBar> linksInTopBar = new ArrayList<>();

    private Map<String, String> xsltParameters = new HashMap<>();

    /**
     *
     * @param configFile
     * @param corpusId (optional) id of the corpus
     * @param corpusConfig (optional) the blacklab configuration for the corpus
     * @throws ConfigurationException when the configFile can't be parsed.
     */
    public WebsiteConfig(File configFile, String corpusId, CorpusConfig corpusConfig, String contextPath) throws ConfigurationException {
        load(configFile, corpusId, corpusConfig, contextPath);
    }

    /**
     * Note that corpus may be null, when parsing the base config.
     *
     * @param configFile
     * @param corpusId (optional) raw name of the corpus, including the username (if applicable), (null when loading the
     *        config for the pages outside a corpus context, such as /about, /help, and / (root)))
     * @param corpus (optional) the corpus as described by blacklab-server
     * @param contextPath the application root url (usually /corpus-frontend). Required for string interpolation while loading the configFile.
     * @throws ConfigurationException
     */
    private void load(File configFile, String corpusId, CorpusConfig corpus, String contextPath) throws ConfigurationException {
        Parameters parameters = new Parameters();
        ConfigurationBuilder<XMLConfiguration> cb = new FileBasedConfigurationBuilder<>(XMLConfiguration.class)
                .configure(parameters.fileBased()
                .setFile(configFile)
                .setListDelimiterHandler(new DisabledListDelimiterHandler())
                .setPrefixLookups(new HashMap<String, Lookup>(ConfigurationInterpolator.getDefaultPrefixLookups()) {{
                    put("request", key -> {
                        switch (key) {
                            case "contextPath": return contextPath;
                            case "corpusId": return corpusId != null ? corpusId : ""; // don't return null, or the interpolation string (${request:corpusId}) will be rendered
                            case "corpusPath": return contextPath + (corpusId != null ? "/" + corpusId : "");
                            default: return key;
                        }
                    });
                }}));
        // Load the specified config file
        XMLConfiguration xmlConfig = cb.getConfiguration();

        this.corpusId = corpusId;
        // Can be specified in multiple places: search.xml, corpusConfig (in blacklab), or as a fallback, just the corpusname with some capitalization and any username removed.
        corpusDisplayName = StringUtils.defaultIfEmpty(xmlConfig.getString("InterfaceProperties.displayName"), StringUtils.defaultIfEmpty(corpus != null ? corpus.getDisplayName() : null, MainServlet.getCorpusName(corpusId)));
        corpusOwner = MainServlet.getCorpusOwner(corpusId);
        pathToCustomJs = xmlConfig.getString("InterfaceProperties.CustomJs");
        pathToCustomCss = xmlConfig.getString("InterfaceProperties.CustomCss");
        pathToFaviconDir = xmlConfig.getString("InterfaceProperties.FaviconDir", contextPath + "/img");
        propColumns = StringUtils.defaultIfEmpty(xmlConfig.getString("InterfaceProperties.PropColumns"), "");
        pagination = xmlConfig.getBoolean("InterfaceProperties.Article.Pagination", true);
        analyticsKey  = xmlConfig.getString("InterfaceProperties.Analytics.Key", "");
        if (corpusOwner != null) {
            linksInTopBar.add(new LinkInTopBar("My corpora", contextPath + "/corpora", false));
        }

        List<HierarchicalConfiguration<ImmutableNode>> myfields = xmlConfig.configurationsAt("InterfaceProperties.NavLinks.Link");
        for (Iterator<HierarchicalConfiguration<ImmutableNode>> it = myfields.iterator(); it.hasNext();) {
            HierarchicalConfiguration<ImmutableNode> sub = it.next();

            String href = sub.getString("[@value]", null);
            String label = sub.getString("");
            boolean newWindow = sub.getBoolean("[@newWindow]", false);
            boolean relative = sub.getBoolean("[@relative]", false); // No longer supported, keep around for compatibility
            if (href == null)
                href = label;

            if (relative)
                href = contextPath + "/" + href;

            linksInTopBar.add(new LinkInTopBar(label, href, newWindow));
        }

        myfields = xmlConfig.configurationsAt("XsltParameters.XsltParameter");
        for (Iterator<HierarchicalConfiguration<ImmutableNode>> it = myfields.iterator(); it.hasNext();) {
            HierarchicalConfiguration<ImmutableNode> sub = it.next();

            String name = sub.getString("[@name]");
            String value = sub.getString("[@value]");

            xsltParameters.put(name, value);
        }
    }

    public String getCorpusId() {
        return corpusId;
    }

    public String getCorpusDisplayName() {
        return corpusDisplayName;
    }

    public String getCorpusOwner() {
        return corpusOwner;
    }

    /**
     * Get the links for use in the navbar
     * Note that links where {@link LinkInTopBar#isRelative()} is true assume that the current page is
     * the context root (by default /corpus-frontend/)
     * Usually this is not the case (when looking at e.g. /corpus-frontend/my-corpus/search),
     * so they will need to be prefixed by some ../../ segments first,
     * this is done using the pathToTop variable in the velocity templates.
     *
     * @return the list of links
     */
    public List<LinkInTopBar> getLinks() {
        return linksInTopBar;
    }

    public Map<String, String> getXsltParameters() {
        return xsltParameters;
    }

    public String getPathToCustomCss() {
        return pathToCustomCss;
    }

    public String getPathToCustomJs() {
        return pathToCustomJs;
    }

    public String getPathToFaviconDir() {
        return pathToFaviconDir;
    }

    public String getPropColumns() {
        return propColumns;
    }

    public boolean usePagination() {
        return pagination;
    }

    public String getAnalyticsKey() {
        return analyticsKey;
    }
}
