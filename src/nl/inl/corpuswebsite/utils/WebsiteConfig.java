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
import java.util.Map;
import java.util.Set;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.configuration.XMLConfiguration;

/**
 * Configuration read from an XML config file.
 */
public class WebsiteConfig {

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

//	/** Internal URL of the webservice (for the server) */
//	private String urlWebserviceInternal;
//
//	/** External URL of the webservice (for the client) */
//	private String urlWebserviceExternal;

//	/** Where to find scanned pages, if there are any */
//	private String pathToSourceImages = null;

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

//	/** Google Analytics key */
//	private String googleAnalyticsKey = null;

	/** Link to put in the top bar  */
	private List<Map<String, Object>> linksInTopBar = new ArrayList<Map<String, Object>>();

	public WebsiteConfig(File configFile) throws ConfigurationException {
		// Load the specified config file
		xmlConfig = new XMLConfiguration();
		xmlConfig.setDelimiterParsingDisabled(true);
		xmlConfig.load(configFile);


		corpusName = xmlConfig.getString("InterfaceProperties.Name", "");

//		urlWebserviceInternal = xmlConfig.getString("InterfaceProperties.WebserviceInternal", "");
//		urlWebserviceExternal = xmlConfig.getString("InterfaceProperties.WebserviceExternal", "");
//		pathToSourceImages = xmlConfig.getString("InterfaceProperties.SourceImagesLocation", "");

		corpusDataFormat = xmlConfig.getString("InterfaceProperties.CorpusDataFormat", "tei");

		colorBackground = xmlConfig.getString("InterfaceProperties.BackgroundColor", "");
		pathToBackgroundImage = xmlConfig.getString("InterfaceProperties.BackgroundImage", "");
		colorLink = xmlConfig.getString("InterfaceProperties.LinkColor", "");
		pathToLogo = xmlConfig.getString("InterfaceProperties.Logo", "");

//		googleAnalyticsKey = xmlConfig.getString("InterfaceProperties.GoogleAnalyticsKey", "");

		List<HierarchicalConfiguration> myfields = xmlConfig.configurationsAt("InterfaceProperties.NavLinks.Link");

		for(Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
		    HierarchicalConfiguration sub = it.next();

		    String location = sub.getString("[@value]", null);
		    String name = sub.getString("");
		    boolean newWindow = sub.getBoolean("[@newWindow]", false);
		    if (location == null)
		    	location = name;

		    Map<String, Object> link = new HashMap<String, Object>();
		    link.put("href", location);
		    link.put("name", name);
		    link.put("newWindow", newWindow);
		    linksInTopBar.add(link);
		}

		myfields = xmlConfig.configurationsAt("DocumentProperties.Property");

		for(Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
		    HierarchicalConfiguration sub = it.next();

		    FieldDescriptor fd = new FieldDescriptor(sub.getString("Name"), sub.getBoolean("Numeric",false), sub.getBoolean("Fuzzy",false), sub.getBoolean("Sensitive",false), sub.getString("SearchField"), sub.getString("DisplayField"), sub.getString("Function"));

		    fd.setType(sub.getString("[@type]"));

		    String tabGroup = sub.getString("TabGroup");
		    addToTabGroups(tabGroup);
		    fd.setTabGroup(tabGroup);

	    	List<HierarchicalConfiguration> values = sub.configurationsAt("Values.Value");

	    	for(Iterator<HierarchicalConfiguration> i = values.iterator(); i.hasNext();) {
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

		for(Iterator<HierarchicalConfiguration> it = myfields.iterator(); it.hasNext();) {
		    HierarchicalConfiguration sub = it.next();
		    FieldDescriptor fd = new FieldDescriptor(sub.getString("Name"), sub.getBoolean("Numeric",false), sub.getBoolean("Fuzzy",false), sub.getBoolean("Sensitive",false), sub.getString("Index"), sub.getString("Index"), sub.getString("Function"));

		    List<HierarchicalConfiguration> values = sub.configurationsAt("Values.Value");

	    	for(Iterator<HierarchicalConfiguration> i = values.iterator(); i.hasNext();) {
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

	public List<FieldDescriptor> getFieldsInTabGroup(String group) {
		List<FieldDescriptor> tabFields = new LinkedList<FieldDescriptor>();

		for(FieldDescriptor fd : fields) {
			if (fd.getTabGroup().equalsIgnoreCase(group) || group.equalsIgnoreCase(""))
				tabFields.add(fd);
		}

		return tabFields;
	}

	public String getCorpusName() {
		return corpusName;
	}

//	public String getWebserviceUrl() {
//		return urlWebserviceInternal;
//	}
//
//	public String getExternalWebserviceUrl() {
//		return urlWebserviceExternal;
//	}

	public List<FieldDescriptor> getWordProperties() {
		return properties;
	}

	public String getPropertyForFunction(String function) {
		for(FieldDescriptor fd : getWordProperties()) {
			if (fd.getFunction().equalsIgnoreCase(function))
				return fd.searchField;
		}

		return "";
	}

	public List<FieldDescriptor> getFilterFields() {
		return fields;
	}

	public boolean containsSearchField(String fieldName) {
		for(FieldDescriptor fd : getFilterFields()) {
			if (fd.getSearchField().equalsIgnoreCase(fieldName))
				return true;
		}

		return false;
	}

	public String getFieldIndexForFunction(String f) {
		for(FieldDescriptor fd : getFilterFields()) {
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

	public String getBackgroundColor () {
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

//	public String getSourceImagesLocation() {
//		return pathToSourceImages;
//	}

	public List<Map<String, Object>> getLinks() {
		return linksInTopBar;
	}

//	public String getGoogleAnalyticsKey() {
//		return googleAnalyticsKey;
//	}

	public String getCorpusDataFormat() {
		return corpusDataFormat;
	}
}
