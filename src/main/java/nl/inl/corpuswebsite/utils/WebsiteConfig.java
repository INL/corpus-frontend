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

		public LinkInTopBar(String name, String href) {
			this(name, href, false);
		}
	}

	/** The configuration read from the XML file */
	private XMLConfiguration xmlConfig;

	/** Name to display for this corpus */
	private String displayName;

	/** Background color to use */
	private String colorBackground = null;

	/** Background image to use */
	private String pathToBackgroundImage = null;

	/** Link color to use */
	private String colorLink = null;

	/** Logo image to use */
	private String pathToLogo = null;

	/** Link to put in the top bar */
	private List<LinkInTopBar> linksInTopBar = new ArrayList<>();

	public WebsiteConfig(InputStream configFile, String corpusName) throws ConfigurationException {
		// Load the specified config file
		xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);

		displayName = xmlConfig.getString("InterfaceProperties.DisplayName", corpusName);

		colorBackground = xmlConfig.getString(
				"InterfaceProperties.BackgroundColor", "");
		pathToBackgroundImage = xmlConfig.getString(
				"InterfaceProperties.BackgroundImage", "");
		colorLink = xmlConfig.getString("InterfaceProperties.LinkColor", "");
		pathToLogo = xmlConfig.getString("InterfaceProperties.Logo", "");

		List<HierarchicalConfiguration> myfields = xmlConfig.configurationsAt("InterfaceProperties.NavLinks.Link");

		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it
				.hasNext();) {
			HierarchicalConfiguration sub = it.next();

			String location = sub.getString("[@value]", null);
			String name = sub.getString("");
			boolean newWindow = sub.getBoolean("[@newWindow]", false);
			if (location == null)
				location = name;
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
}
