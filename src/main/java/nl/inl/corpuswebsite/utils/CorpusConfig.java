package nl.inl.corpuswebsite.utils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

public class CorpusConfig {
	private Document config;

	private Set<FieldDescriptor> metadataFields = new LinkedHashSet<>();

	public CorpusConfig(String xml) throws SAXException, IOException, ParserConfigurationException {
		config = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new InputSource(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));

		parse();
	}

	public Set<FieldDescriptor> getMetadataFields() {
		return metadataFields;
	}

	private void parse() {
		// Keyed by name of field
		Map<String, FieldDescriptor> parsedFields = new HashMap<>();

		NodeList xmlMetadataFields = config.getElementsByTagName("metadataField");
		// Parse all metadatafields first
		for (int i = 0; i < xmlMetadataFields.getLength(); i++) {
			Node node = xmlMetadataFields.item(i);
			if (!(node instanceof Element))
				continue;
			Element element= (Element) node;

			String fieldName	= element.getElementsByTagName("fieldName").item(0).getTextContent();
			String displayName	= element.getElementsByTagName("displayName").item(0).getTextContent();
			String type			= element.getElementsByTagName("type").item(0).getTextContent();

			parsedFields.put(fieldName, new FieldDescriptor(fieldName, displayName, type));
		}

		// Set the group for all metadatafields
		NodeList xmlMetadataFieldGroups = config.getElementsByTagName("metadataFieldGroup");
		for (int mdfgIndex = 0; mdfgIndex < xmlMetadataFieldGroups.getLength(); mdfgIndex++) {
			Node node = xmlMetadataFieldGroups.item(mdfgIndex);
			if (!(node instanceof Element))
				continue;
			Element element = (Element) node;

			String groupName = element.getElementsByTagName("name").item(0).getTextContent();

			NodeList xmlFields = element.getElementsByTagName("field");
			for (int xmlFieldIndex = 0; xmlFieldIndex < xmlFields.getLength(); xmlFieldIndex++) {
				String fieldName = xmlFields.item(xmlFieldIndex).getTextContent();

				if (parsedFields.containsKey(fieldName))
					parsedFields.get(fieldName).setTabGroup(groupName);
			}
		}

		for (Map.Entry<String, FieldDescriptor> e : parsedFields.entrySet()) {
			this.metadataFields.add(e.getValue());
		}
	}
}
