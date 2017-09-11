/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.configuration.XMLConfiguration;

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

	/** Name to display for this corpus */
	private String displayName;

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

	private void load(InputStream configFile, String corpus) throws ConfigurationException {
		// Load the specified config file
		xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);

		// TODO format the name for user corpora here instead of in javascript...
		displayName = xmlConfig.getString("InterfaceProperties.DisplayName", corpus);
		if (displayName == null) // no explicit displayname set and corpus was null as well, use a fallback
			displayName = "AutoSearch";

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

			// TODO unify this with processUrl
			if (relative) {
				if (corpus != null)
					location = absoluteContextPath + "/" + corpus + "/" + location;
				else
					location = absoluteContextPath + "/" + location;
			}

			linksInTopBar.add(new LinkInTopBar(name, location, newWindow));
		}

	}

	public String getCorpusDisplayName() {
		return displayName;
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
