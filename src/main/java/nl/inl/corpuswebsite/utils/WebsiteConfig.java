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

	/** The configuration read from the XML file */
	private XMLConfiguration xmlConfig;

	/** Name to display for this corpus, null if no corpus set. Falls back to the corpus name if not explicitly configured. */
	private String corpusDisplayName;

	/** Raw name for this corpus, null if no corpus set. */
	private String corpusName;

	/** User for this corpus, null if no corpus set or this corpus has no owner. */
	private String corpusOwner;

	/** Background color to use */
	private String colorBackground;

	/** Link color to use */
	private String colorLink;

	/** Background image to use */
	private String pathToBackgroundImage;

	/** Logo image to use */
	private String pathToLogo;

	/** Link to put in the top bar */
	private List<LinkInTopBar> linksInTopBar = new ArrayList<>();

	private Map<String, String> xsltParameters = new HashMap<>();

	/**
	 *
	 * @param configFile
	 * @param absoluteContextPath
	 * @param corpus
	 * @throws ConfigurationException
	 */
	public WebsiteConfig(InputStream configFile, String absoluteContextPath, String corpus) throws ConfigurationException {
		if (!absoluteContextPath.startsWith("/"))
			throw new RuntimeException("AbsoluteContextPath is not absolute");

		this.absoluteContextPath = absoluteContextPath;

		load(configFile, corpus);
	}

	/**
	 * Note that corpus may be null, when parsing the base config.
	 * @param configFile
	 * @param corpus raw name of the corpus, including the username (if applicable), might be null (when loading the config for the pages outside a corpus context, such as /about, /help, and / (root)))
	 * @throws ConfigurationException
	 */
	private void load(InputStream configFile, String corpus) throws ConfigurationException {
		// Load the specified config file
		xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);

		corpusName = MainServlet.getCorpusName(corpus);
		corpusOwner = MainServlet.getCorpusOwner(corpus);
		corpusDisplayName = xmlConfig.getString("InterfaceProperties.DisplayName", corpusName);

		colorBackground 		= xmlConfig.getString("InterfaceProperties.BackgroundColor");
		colorLink 				= xmlConfig.getString("InterfaceProperties.LinkColor");
		pathToBackgroundImage 	= processUrl(xmlConfig.getString("InterfaceProperties.BackgroundImage"));
		pathToLogo 				= processUrl(xmlConfig.getString("InterfaceProperties.Logo"));

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

		myfields = xmlConfig.configurationsAt("XsltParameters");
		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
			HierarchicalConfiguration sub = it.next();

			xsltParameters.put(sub.getString("[@name]"), sub.getString("[@value]"));
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

	public String getBackgroundColor() {
		return colorBackground;
	}

	public String getBackgroundImage() {
		return pathToBackgroundImage;
	}

	public String getLinkColor() {
		return colorLink;
	}

	public String getLogo() {
		return pathToLogo;
	}

	public List<LinkInTopBar> getLinks() {
		return linksInTopBar;
	}

	public Map<String, String> getXsltParameters() {
		return xsltParameters;
	}

	// TODO centralize this
	// TODO sanity checking and fixing common errors
	private String processUrl(String link) {
		if (link == null)
			return link;

		if (link.startsWith("/"))
			link = link.substring(1);

		return absoluteContextPath + "/" + link;
	}
}
