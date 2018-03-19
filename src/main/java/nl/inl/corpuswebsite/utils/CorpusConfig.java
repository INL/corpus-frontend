package nl.inl.corpuswebsite.utils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

public class CorpusConfig {
	private String jsonUnescaped;

	private Document config;

	private List<FieldDescriptor> propertyFields = new ArrayList<>();

	/** Keyed by tab name */
	private Map<String, List<FieldDescriptor>> metadataFieldGroups = new LinkedHashMap<>();
	private List<FieldDescriptor> ungroupedMetadataFields = new ArrayList<>();

	/** Mapping between generic names for some properties of documents in this corpus (titleField, pidField, authorField, etc)
	 * 	to their actual names */
	private Map<String, String> fieldInfo = new LinkedHashMap<>();

	private String corpusDataFormat = "UNKNOWN";

	public CorpusConfig(String xml, String jsonUnescaped) throws SAXException, IOException, ParserConfigurationException {
		config = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new InputSource(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));
		this.jsonUnescaped = jsonUnescaped;
		parse();
	}

	public String getJsonUnescaped() {
		return jsonUnescaped;
	}

	public List<FieldDescriptor> getPropertyFields() {
		return propertyFields;
	}

	public Map<String, List<FieldDescriptor>> getMetadataFieldGroups() {
		return metadataFieldGroups;
	}

	public List<FieldDescriptor> getUngroupedMetadataFields() {
		return ungroupedMetadataFields;
	}

	/* TEI, FoLiA, etc */
	public String getCorpusDataFormat() {
		return corpusDataFormat;
	}

	public Map<String, String> getFieldInfo() {
		return fieldInfo;
	}

	private void parse() {
		parseCorpusDataFormat();
		parsePropertyFields();
		parseMetadataFields();
		parseFieldInfo();
	}

	private void parseCorpusDataFormat() {
		NodeList documentFormatTags = config.getElementsByTagName("documentFormat");
		if (documentFormatTags.getLength() > 0)
		    this.corpusDataFormat = documentFormatTags.item(0).getTextContent();
		this.corpusDataFormat = "UNKNOWN";
	}

	private void parsePropertyFields() {
		// Since there's only one complexField at the moment, just get all <property> elements right away
		// instead of going through complexFields->complexField->properties->property
		NodeList propertyNodeList = config.getElementsByTagName("property");
		for (int ip = 0; ip < propertyNodeList.getLength(); ip++) {
			Node propertyNode = propertyNodeList.item(ip);
			if (!(propertyNode instanceof Element))
				continue;

			Element propertyElement = (Element) propertyNode;
			if (propertyElement.getElementsByTagName("isInternal").item(0).getTextContent().equalsIgnoreCase("true"))
				continue;

			String fieldName 		= propertyElement.getAttribute("name");
			String displayName 		= propertyElement.getElementsByTagName("displayName").item(0).getTextContent();
			boolean caseSensitive 	= propertyElement.getElementsByTagName("sensitivity").item(0).getTextContent().equals("SENSITIVE_AND_INSENSITIVE");

			FieldDescriptor field = new FieldDescriptor(fieldName, displayName, null);
			field.setCaseSensitive(caseSensitive);
			this.propertyFields.add(field);
		}
	}

	private void parseMetadataFields() {
		// Keyed by name of field
		Map<String, FieldDescriptor> parsedFields = new HashMap<>();

		// Parse all metadata fields
		NodeList metadataFieldNodeList = config.getElementsByTagName("metadataField");
		for (int imf = 0; imf < metadataFieldNodeList.getLength(); imf++) {
			Node metadataFieldNode = metadataFieldNodeList.item(imf);
			if (!(metadataFieldNode instanceof Element))
				continue;
			Element metadataFieldElement = (Element) metadataFieldNode;

			String fieldName					= metadataFieldElement.getElementsByTagName("fieldName").item(0).getTextContent();
			String displayName					= metadataFieldElement.getElementsByTagName("displayName").item(0).getTextContent();
			String type							= metadataFieldElement.getElementsByTagName("uiType").item(0).getTextContent();
			Map<String, String> allowedValues 	= parseMetadataValues(metadataFieldElement);


			// If the field type is not specified, infer it based on whether we have any or all or no known allowed values
			// No values known == text
			// All values known == select
			// Some values known == combobox (has dropdown but also allows user-entered values)
			if (type == null || type.isEmpty()) {
				if (allowedValues.isEmpty())
					type = "text";
				else if (allValuesKnown(metadataFieldElement)) {
					type = "select";
				} else {
					type = "combobox";
				}
			}

			FieldDescriptor field = new FieldDescriptor(fieldName, displayName, type);
			for (Map.Entry<String, String> valueWithDisplayName : allowedValues.entrySet())
				field.addValidValue(valueWithDisplayName.getKey(), valueWithDisplayName.getValue());

			parsedFields.put(fieldName, field);
		}

		// Store all fields belonging to a group, then finally store all remaining fields.
		NodeList xmlMetadataFieldGroups = config.getElementsByTagName("metadataFieldGroup");
		for (int mdfgIndex = 0; mdfgIndex < xmlMetadataFieldGroups.getLength(); mdfgIndex++) {
			Node node = xmlMetadataFieldGroups.item(mdfgIndex);
			if (!(node instanceof Element))
				continue;
			Element element = (Element) node;

			String groupName = element.getElementsByTagName("name").item(0).getTextContent();

			NodeList fieldNodeList = element.getElementsByTagName("field"); // Fields in this group
			for (int fieldIndex = 0; fieldIndex < fieldNodeList.getLength(); fieldIndex++) {
				String fieldName = fieldNodeList.item(fieldIndex).getTextContent();

				if (parsedFields.containsKey(fieldName)) {

					FieldDescriptor field = parsedFields.get(fieldName);
					// Remove the field from our running list so we don't also insert it into the default group later.
					parsedFields.remove(fieldName);

					// Strip the groupname from the displayname of the field
					if (field.getDisplayName().length() > groupName.length() && field.getDisplayName().toLowerCase().startsWith(groupName.toLowerCase())) {
						// Remove group
						String newDisplayName = field.getDisplayName().substring(groupName.length()).trim();
						// Capitalize first char
						newDisplayName = newDisplayName.substring(0, 1).toUpperCase(Locale.ROOT) + newDisplayName.substring(1);

						field.setDisplayName(newDisplayName);
					}

					addMetadataField(field, groupName);
				}
			}
		}

		// Remaining fields are ungrouped groups
		for (Map.Entry<String, FieldDescriptor> e : parsedFields.entrySet()) {
			addMetadataField(e.getValue(), null);
		}
	}

	private void parseFieldInfo() {
		Node fieldInfoNode = this.config.getElementsByTagName("fieldInfo").item(0);
		if (fieldInfoNode == null)
			return;

		NodeList fieldInfoChildren = fieldInfoNode.getChildNodes();
		for (int i = 0; i < fieldInfoChildren.getLength(); i++) {
			Node fieldInfoChildNode = fieldInfoChildren.item(i);
			this.fieldInfo.put(fieldInfoChildNode.getNodeName(), fieldInfoChildNode.getTextContent());
		}
	}


	private static boolean allValuesKnown(Element metadataFieldElement) {
		return Boolean.parseBoolean(metadataFieldElement.getElementsByTagName("valueListComplete").item(0).getTextContent());
	}

	/**
	 * Parse all known fieldValues for this metadata field.
	 *
	 * Note: displayValue defaults to the raw value if it is not specified.
	 * @param metadataFieldElement the fieldValues xml node
	 * @return a map of values in the form of (value, displayValue)
	 */
	private static Map<String, String> parseMetadataValues(Element metadataFieldElement) {
		// LinkedHashMap, it's important these values stay in the order in which we parse them
		Map<String, String> values = new LinkedHashMap<>();

		// Gather all values
		Node fieldValuesNode = metadataFieldElement.getElementsByTagName("fieldValues").item(0);
		if (fieldValuesNode instanceof Element) {
			NodeList fieldValueNodeList = ((Element) fieldValuesNode).getElementsByTagName("value");
			for (int ifv = 0; ifv < fieldValueNodeList.getLength(); ifv++) {
				NamedNodeMap attributes = fieldValueNodeList.item(ifv).getAttributes();
				if (attributes == null || attributes.getNamedItem("text") == null)
					continue;

				// Empty values are ignored as they are not searchable
				String value = attributes.getNamedItem("text").getTextContent();
				if (value == null || value.isEmpty())
					continue;

				// Set the display value to be identical to the actual value for now
				values.put(value, value);
			}
		}

		// Now set the displayValues where provided.
		Node displayValuesNode = metadataFieldElement.getElementsByTagName("displayValues").item(0);
		if (displayValuesNode instanceof Element) {
			NodeList displayValueNodeList = ((Element) displayValuesNode).getElementsByTagName("displayValue");
			for (int idv = 0; idv < displayValueNodeList.getLength(); idv++) {
				Node displayValueNode = displayValueNodeList.item(idv);

				String value = displayValueNode.getAttributes().getNamedItem("value").getTextContent();
				String valueDisplayName = displayValueNode.getTextContent();
				if (values.containsKey(value))
					values.put(value, valueDisplayName);
			}
		}

		return values;
	}

	private void addMetadataField(FieldDescriptor field, String groupName) {
		if (groupName != null) {
			assert !groupName.isEmpty() : "MetadataField group must not be empty";

			if (!this.metadataFieldGroups.containsKey(groupName))
				this.metadataFieldGroups.put(groupName, new ArrayList<FieldDescriptor>());
			this.metadataFieldGroups.get(groupName).add(field);
		} else {
			this.ungroupedMetadataFields.add(field);
		}
	}
}
