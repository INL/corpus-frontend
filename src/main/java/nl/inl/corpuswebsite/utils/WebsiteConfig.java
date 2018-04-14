/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.configuration.XMLConfiguration;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.MainServlet;

/**
 * Configuration read from an XML config file.
 */
public class WebsiteConfig {

	/** One of the links shown in the top bar */
	static class LinkInTopBar extends HashMap<String, Object> {
		public LinkInTopBar(String name, String href, boolean newWindow) {
			put("name", name);
			put("href", href);
			put("newWindow", newWindow);
		}
	}

	private String absoluteContextPath;

	/** Name to display for this corpus, null if no corpus set. Falls back to the corpus name if not explicitly configured. */
	private String corpusDisplayName;

	/** Raw name for this corpus, null if no corpus set. */
	private String corpusName;

	/** User for this corpus, null if no corpus set or this corpus has no owner. */
	private String corpusOwner;

	/** Custom css to use */
	private String pathToCustomCss;

	/** Custom js to use */
	private String pathToCustomJs;

    /** properties to show in columns */
	private String[] propColumns = new String[] {};

	/** Link to put in the top bar */
	private List<LinkInTopBar> linksInTopBar = new ArrayList<>();

	private Map<String, String> xsltParameters = new HashMap<>();
    
    


	/**
	 *
	 * @param configFile
	 * @param absoluteContextPath
	 * @param corpus
     * @param corpusConfig the blacklab configuration for the corpus
	 * @throws ConfigurationException
	 */
	public WebsiteConfig(InputStream configFile, String absoluteContextPath, String corpus, CorpusConfig corpusConfig) throws ConfigurationException {
		if (!absoluteContextPath.startsWith("/"))
			throw new RuntimeException("AbsoluteContextPath is not absolute");

		this.absoluteContextPath = absoluteContextPath;
        
        initProps(corpusConfig);

		load(configFile, corpus);

		if (corpusDisplayName == null) { // no displayName set
		    String backendDisplayName = corpusConfig.getDisplayName();
		    if (backendDisplayName != null && !backendDisplayName.isEmpty() && !backendDisplayName.equals(corpus))
		        corpusDisplayName = backendDisplayName;
		    else
		        corpusDisplayName = MainServlet.getCorpusName(corpus); // strip username prefix from corpus ID, and use remainder
		}
	}

    /**
     * 
     * initializes the max 3 properties to show in columns, lemma and pos, when present, will be in these 3.
     * @param corpusConfig 
     */
    private void initProps(CorpusConfig corpusConfig) {
        List<FieldDescriptor> fd = new ArrayList<>(3);
        
        corpusConfig.getPropertyFields().stream()
                .filter((pf) -> ("lemma".equals(pf.getId()) || "pos".equals(pf.getId())))
                .forEach((pf) -> {
                    fd.add(pf);
                });
        
        corpusConfig.getPropertyFields().stream()
                .filter((pf) -> (fd.size()<3))
                .filter((pf) -> (!fd.contains(pf)))
                .filter((pf) -> (!"word".equals(pf.getId()))) // TODO hardcoded string, other check for main prop
                .forEach((pf) -> {
                    fd.add(pf);
                });
        if (fd.size()>0) {
            propColumns = new String[fd.size()];
            short i = 0;
            for (FieldDescriptor f : fd) {
                propColumns[i] = f.getId();
                i++;
            }
        }
    }

	/**
	 * Note that corpus may be null, when parsing the base config.
	 * @param configFile
	 * @param corpus raw name of the corpus, including the username (if applicable), might be null (when loading the config for the pages outside a corpus context, such as /about, /help, and / (root)))
	 * @throws ConfigurationException
	 */
	private void load(InputStream configFile, String corpus) throws ConfigurationException {
		// Load the specified config file
		XMLConfiguration xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);

		corpusName = MainServlet.getCorpusName(corpus);
		corpusOwner = MainServlet.getCorpusOwner(corpus);
		corpusDisplayName = xmlConfig.getString("InterfaceProperties.DisplayName", null);

		pathToCustomJs          = processUrl(xmlConfig.getString("InterfaceProperties.CustomJs"));
		pathToCustomCss         = processUrl(xmlConfig.getString("InterfaceProperties.CustomCss"));
		String props         = xmlConfig.getString("InterfaceProperties.PropColumns");
        if (props!=null&&!props.isEmpty()) {
            propColumns = StringUtils.split(props);
        }
        

		List<HierarchicalConfiguration> myfields = xmlConfig.configurationsAt("InterfaceProperties.NavLinks.Link");
		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
			HierarchicalConfiguration sub = it.next();

			String location = sub.getString("[@value]", null);
			String name = sub.getString("");
			boolean newWindow = sub.getBoolean("[@newWindow]", false);
			boolean relative = sub.getBoolean("[@relative]", false);
			if (location == null)
				location = name;

			if (relative)
				location = processUrl(location);

			linksInTopBar.add(new LinkInTopBar(name, location, newWindow));
		}

		myfields = xmlConfig.configurationsAt("XsltParameters.XsltParameter");
		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
			HierarchicalConfiguration sub = it.next();

			String name = sub.getString("[@name]");
			String value = sub.getString("[@value]");

			xsltParameters.put(name, value);
		}
	}

	public String getCorpusDisplayName() {
		return corpusDisplayName;
	}

	public String getCorpusName() {
		return corpusName;
	}

	public String getCorpusOwner() {
		return corpusOwner;
	}

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

	// TODO centralize normalizing/making relative of links (mainservlet static func?)
	private String processUrl(String link) {
		if (link == null)
			return link;

		link = StringUtils.stripStart(link.trim(), "./");

		return absoluteContextPath + "/" + link;
	}

    public String getPropColumns() {
        return StringUtils.join(propColumns, ",");
    }
    
}
