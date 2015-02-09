/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

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

	/** Search fields */
	private List<FieldDescriptor> fields = new LinkedList<FieldDescriptor>();

	/** Properties for the contents field */
	private List<FieldDescriptor> properties = new LinkedList<FieldDescriptor>();

	/** Tab groups for our search fields */
	private Set<String> tabGroups = new LinkedHashSet<String>();

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
	private List<LinkInTopBar> linksInTopBar = new ArrayList<LinkInTopBar>();

	public WebsiteConfig(File configFile) throws ConfigurationException {
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

		myfields = xmlConfig.configurationsAt("DocumentProperties.Property");

		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it
				.hasNext();) {
			HierarchicalConfiguration sub = it.next();

			FieldDescriptor fd = new FieldDescriptor(sub.getString("Name"),
					sub.getBoolean("Numeric", false), sub.getBoolean("Fuzzy",
							false), sub.getBoolean("Sensitive", false),
					sub.getString("SearchField"),
					sub.getString("DisplayField"), sub.getString("Function"));

			fd.setType(sub.getString("[@type]"));

			String tabGroup = sub.getString("TabGroup");
			addToTabGroups(tabGroup);
			fd.setTabGroup(tabGroup);

			List<HierarchicalConfiguration> values = sub
					.configurationsAt("Values.Value");

			for (Iterator<HierarchicalConfiguration> i = values.iterator(); i
					.hasNext();) {
				HierarchicalConfiguration value = i.next();

				String attrValue = value.getString("[@value]", "");
				String description = value.getString("", "");
				if (description.length() == 0)
					description = attrValue;
				fd.addValidValue(attrValue, description);

				boolean isMultiple = sub.getBoolean("Values[@multiple]", false);
				if (isMultiple)
					fd.setType("multiselect");
			}

			fields.add(fd);
		}

		myfields = xmlConfig.configurationsAt("WordProperties.Property");

		for (Iterator<HierarchicalConfiguration> it = myfields.iterator(); it
				.hasNext();) {
			HierarchicalConfiguration sub = it.next();
			FieldDescriptor fd = new FieldDescriptor(sub.getString("Name"),
					sub.getBoolean("Numeric", false), sub.getBoolean("Fuzzy",
							false), sub.getBoolean("Sensitive", false),
					sub.getString("Index"), sub.getString("Index"),
					sub.getString("Function"));

			List<HierarchicalConfiguration> values = sub
					.configurationsAt("Values.Value");

			for (Iterator<HierarchicalConfiguration> i = values.iterator(); i
					.hasNext();) {
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
		corpusDataFormat = "tei";
		colorBackground = "";
		pathToBackgroundImage = "";
		colorLink = "";
		pathToLogo = "";
		
		linksInTopBar.add(new LinkInTopBar("Help", "../help"));
		linksInTopBar.add(new LinkInTopBar("INL", "http://www.inl.nl/", true));
		linksInTopBar.add(new LinkInTopBar("CLARIN", "http://www.clarin.eu/", true));
		linksInTopBar.add(new LinkInTopBar("NTU", "http://taalunie.org/", true));
		
		properties.add(new FieldDescriptor("Wordform", false, false, true, "word", "word", "wordform"));
		properties.add(new FieldDescriptor("Lemma", false, false, false, "lemma", "lemma", "lemma"));
		properties.add(new FieldDescriptor("P.o.S.", false, false, false, "pos", "pos", "pos"));
	}

	/** Generic config
	 * @param corpus name of the corpus
	 * @return a generic configuration object
	 */
	public static WebsiteConfig generic(String corpus) {
		return new WebsiteConfig(corpus);
	}	
	
	/**
	 * @param tabGroup
	 */
	private void addToTabGroups(String tabGroup) {
		if (tabGroup == null)
			return;

		if (tabGroup.length() > 0)
			tabGroups.add(tabGroup);
	}

	public Set<String> getTabGroups() {
		return tabGroups;
	}
	
	public boolean hasMetadataFields() {
		return fields.size() > 0;
	}

	public List<FieldDescriptor> getFieldsInTabGroup(String group) {
		List<FieldDescriptor> tabFields = new LinkedList<FieldDescriptor>();

		for (FieldDescriptor fd: fields) {
			if (fd.getTabGroup().equalsIgnoreCase(group)
					|| group.equalsIgnoreCase(""))
				tabFields.add(fd);
		}

		return tabFields;
	}

	public String getCorpusName() {
		return corpusName;
	}

	public List<FieldDescriptor> getWordProperties() {
		return properties;
	}

	public String getPropertyForFunction(String function) {
		for (FieldDescriptor fd: getWordProperties()) {
			if (fd.getFunction().equalsIgnoreCase(function))
				return fd.searchField;
		}

		return "";
	}

	public List<FieldDescriptor> getFilterFields() {
		return fields;
	}

	public boolean containsSearchField(String fieldName) {
		for (FieldDescriptor fd: getFilterFields()) {
			if (fd.getSearchField().equalsIgnoreCase(fieldName))
				return true;
		}

		return false;
	}

	public String getFieldIndexForFunction(String f) {
		for (FieldDescriptor fd: getFilterFields()) {
			if (fd.getFunction().equalsIgnoreCase(f))
				return fd.getDisplayField();
		}

		return "";
	}

	public boolean hasTabGroups() {
		if (tabGroups.size() > 0)
			return true;

		return false;
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
