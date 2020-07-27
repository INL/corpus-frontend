package nl.inl.corpuswebsite.utils;

import java.io.File;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.builder.ConfigurationBuilder;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.builder.fluent.Parameters;
import org.apache.commons.configuration2.convert.DisabledListDelimiterHandler;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.interpol.ConfigurationInterpolator;
import org.apache.commons.configuration2.interpol.Lookup;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.MainServlet;

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

    private final Optional<String> corpusId;
    
    /**
     * Name to display for this corpus, null if no corpus set. Falls back to the corpus name if not explicitly configured.
     */
    private final Optional<String> corpusDisplayName;

    /** User for this corpus, unset if no corpus set or this corpus has no owner. */
    private final Optional<String> corpusOwner;

    /** Custom css to use */
    private final Optional<String> pathToCustomCss;

    /** Custom js to use */
    private final Optional<String> pathToCustomJs;

    /** Should be a directory */
    private final String pathToFaviconDir;

    /** properties to show in result columns, empty string if no corpus set or not configured for this corpus */
    private final Optional<String> propColumns;

    /** Allow suppressing pagination on the article page. This causes the article xslt to receive the full document instead of only a snippet */
    private final boolean pagination;

    /** Page size to use for paginating documents in this corpus, defaults to 1000 if omitted (also see default Search.xml) */
    private final int pageSize;
    
    /** Google analytics key, analytics are disabled if not provided */
    private final Optional<String> analyticsKey;

    /** Link to put in the top bar */
    private final List<LinkInTopBar> linksInTopBar;

    private final Map<String, String> xsltParameters;

    /**
     * Note that corpus may be null, when parsing the default website settings for non-corpus pages (such as the landing page).
     *
     * @param configFile the Search.xml file
     * @param corpusId (optional) raw name of the corpus, including the username (if applicable), (null when loading the
     *        config for the pages outside a corpus context, such as /about, /help, and / (root)))
     * @param corpus (optional) the corpus as described by blacklab-server
     * @param contextPath the application root url (usually /corpus-frontend). Required for string interpolation while loading the configFile.
     * @throws ConfigurationException
     */
    
    public WebsiteConfig(File configFile, Optional<CorpusConfig> corpusConfig, String contextPath) throws ConfigurationException {
    	 Parameters parameters = new Parameters();
         ConfigurationBuilder<XMLConfiguration> cb = new FileBasedConfigurationBuilder<>(XMLConfiguration.class)
                 .configure(parameters.fileBased()
                 .setFile(configFile)
                 .setListDelimiterHandler(new DisabledListDelimiterHandler())
                 .setPrefixLookups(new HashMap<String, Lookup>(ConfigurationInterpolator.getDefaultPrefixLookups()) {{
                     put("request", key -> {
                         switch (key) {
                             case "contextPath": return contextPath;
                             case "corpusId": return corpusConfig.map(CorpusConfig::getCorpusId).orElse(""); // don't return null, or the interpolation string (${request:corpusId}) will be rendered
                             case "corpusPath": return contextPath + corpusConfig.map(c -> "/" + c.getCorpusId()).orElse("");
                             default: return key;
                         }
                     });
                 }}));
         // Load the specified config file
         XMLConfiguration xmlConfig = cb.getConfiguration();

         corpusId = corpusConfig.map(CorpusConfig::getCorpusId);
         // Can be specified in multiple places: search.xml, corpusConfig (in blacklab), or as a fallback, just the corpusname with some capitalization and any username removed.
         corpusDisplayName = Arrays.asList(
    		 xmlConfig.getString("InterfaceProperties.DisplayName"),
    		 corpusConfig.flatMap(CorpusConfig::getDisplayName).orElse(""),
    		 MainServlet.getCorpusName(corpusId).orElse("")
		 )
		 .stream().map(StringUtils::trimToNull).filter(s -> s != null).findFirst();	 
         corpusOwner = MainServlet.getCorpusOwner(corpusId);
         pathToCustomJs = Optional.ofNullable(StringUtils.trimToNull(xmlConfig.getString("InterfaceProperties.CustomJs")));
         pathToCustomCss = Optional.ofNullable(StringUtils.trimToNull(xmlConfig.getString("InterfaceProperties.CustomCss")));
         pathToFaviconDir = xmlConfig.getString("InterfaceProperties.FaviconDir", contextPath + "/img");
         propColumns = Optional.ofNullable(StringUtils.trimToNull(xmlConfig.getString("InterfaceProperties.PropColumns")));
         pagination = xmlConfig.getBoolean("InterfaceProperties.Article.Pagination", false);
         pageSize = Math.max(1, xmlConfig.getInt("InterfaceProperties.Article.PageSize", 1000));
         analyticsKey = Optional.ofNullable(StringUtils.trimToNull(xmlConfig.getString("InterfaceProperties.Analytics.Key")));
         linksInTopBar = Stream.concat(
			 corpusOwner.isPresent() ? Stream.of(new LinkInTopBar("My corpora", contextPath + "/corpora", false)) : Stream.empty(),
			 xmlConfig.configurationsAt("InterfaceProperties.NavLinks.Link").stream().map(sub -> {
				 String label = sub.getString("");
				 String href = StringUtils.defaultIfEmpty(sub.getString("[@value]"), label);
				 boolean newWindow = sub.getBoolean("[@newWindow]", false);
				 boolean relative = sub.getBoolean("[@relative]", false); // No longer supported, keep around for compatibility
				 if (relative)
					 href = contextPath + "/" + href;
				 
				 return new LinkInTopBar(label, href, newWindow);
			 })
		 ).collect(Collectors.toList());
         xsltParameters = xmlConfig.configurationsAt("XsltParameters.XsltParameter").stream()
        		 .collect(Collectors.toMap(sub -> sub.getString("[@name]"), sub -> sub.getString("[@value]")));
    }

    public Optional<String> getCorpusId() {
        return corpusId;
    }

    public Optional<String> getCorpusDisplayName() {
        return corpusDisplayName;
    }

    public Optional<String> getCorpusOwner() {
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

    public Optional<String> getPathToCustomCss() {
        return pathToCustomCss;
    }

    public Optional<String> getPathToCustomJs() {
        return pathToCustomJs;
    }

    public String getPathToFaviconDir() {
        return pathToFaviconDir;
    }

    public Optional<String> getPropColumns() {
        return propColumns;
    }

    public boolean usePagination() {
        return pagination;
    }
    
    public int getPageSize() {
    	return pageSize;
    }

    public Optional<String> getAnalyticsKey() {
        return analyticsKey;
    }
}
