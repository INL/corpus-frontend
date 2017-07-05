/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
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

	/** Properties for the contents field */
	private List<FieldDescriptor> properties = new LinkedList<>();

	/** Name of the corpus we're searching */
	private String corpusName;

	/** What format the corpus XML is in (tei, folia, etc.) */
	private String corpusDataFormat = null;

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

	public WebsiteConfig(InputStream configFile) throws ConfigurationException {
		// Load the specified config file
		xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);

		corpusName = xmlConfig.getString("InterfaceProperties.Name", "");

		corpusDataFormat = xmlConfig.getString(
				"InterfaceProperties.CorpusDataFormat", "tei");

		colorBackground = xmlConfig.getString(
				"InterfaceProperties.BackgroundColor", "");
		pathToBackgroundImage = xmlConfig.getString(
				"InterfaceProperties.BackgroundImage", "");
		colorLink = xmlConfig.getString("InterfaceProperties.LinkColor", "");
		pathToLogo = xmlConfig.getString("InterfaceProperties.Logo", "");

		List<HierarchicalConfiguration> myfields = xmlConfig
				.configurationsAt("InterfaceProperties.NavLinks.Link");

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


		myfields = xmlConfig.configurationsAt("WordProperties.Property");
		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it
				.hasNext();) {
			HierarchicalConfiguration sub = it.next();
			// name and displayname are not swapped around, just a different naming convention in search.xml
			FieldDescriptor fd = new FieldDescriptor(sub.getString("Index"), sub.getString("Name"), "");

			fd.setCaseSensitive(sub.getBoolean("Sensitive", false));

			List<HierarchicalConfiguration> values = sub.configurationsAt("Values.Value");

			for (Iterator<HierarchicalConfiguration> i = values.iterator(); i.hasNext();) {
				HierarchicalConfiguration value = i.next();

				String attrValue = value.getString("[@value]", "");
				String description = value.getString("", "");

				if (description.length() == 0)
					description = attrValue;
				fd.addValidValue(attrValue, description);
			}

			properties.add(fd);
		}
	}

	/** Create a generic config object, if there's no config file available.
	 * @param corpusName name of the corpus
	 */
	private WebsiteConfig(String corpusName) {
		// TODO: get all this from index metadata!
		this.corpusName = corpusName;
		corpusDataFormat = "tei-or-folia";
		colorBackground = "";
		pathToBackgroundImage = "";
		colorLink = "";
		pathToLogo = "";

		linksInTopBar.add(new LinkInTopBar("Help", "../help"));
		linksInTopBar.add(new LinkInTopBar("IvdNT", "http://www.ivdnt.org/", true));
		linksInTopBar.add(new LinkInTopBar("CLARIN", "http://www.clarin.eu/", true));
		linksInTopBar.add(new LinkInTopBar("NTU", "http://taalunie.org/", true));

		// TODO update to new version once FieldDescriptor format is stable
		properties.add(new FieldDescriptor("word", "Wordform", "text"));
		properties.add(new FieldDescriptor("lemma", "Lemma", "text"));
		properties.add(new FieldDescriptor("pos", "P.o.S.", "text"));
	}

	/** Generic config
	 * @param corpus name of the corpus
	 * @return a generic configuration object
	 */
	public static WebsiteConfig generic(String corpus) {
		return new WebsiteConfig(corpus);
	}

	public String getCorpusName() {
		return corpusName;
	}

	public List<FieldDescriptor> getWordProperties() {
		return properties;
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

	public String getCorpusDataFormat() {
		return corpusDataFormat;
	}
}
