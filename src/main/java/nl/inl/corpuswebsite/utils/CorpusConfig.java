package nl.inl.corpuswebsite.utils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPathExpressionException;

import org.apache.commons.lang3.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

public class CorpusConfig {
    private final String jsonUnescaped;

    private final Document config;
    
    private final String corpusId;

    private final Optional<String> displayName;

    private final Optional<String> corpusDataFormat;
    
    public CorpusConfig(String corpusId, String configAsXml, String configAsJson) throws SAXException, IOException, ParserConfigurationException {
        config = fromXml(configAsXml);
        this.corpusId = corpusId;
        this.jsonUnescaped = configAsJson;
        this.displayName = parseDisplayName();
        this.corpusDataFormat = parseCorpusDataFormat();
    }

    public static Document fromXml(String xml) throws ParserConfigurationException, SAXException, IOException {
        return DocumentBuilderFactory.newInstance()
            .newDocumentBuilder()
            .parse(new InputSource(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));
    }

    public String getJsonUnescaped() {
        return jsonUnescaped;
    }
    
    public String getCorpusId() {
    	return corpusId;
    }

    /**
     * @return the displayName for this corpus as configured in BlackLab-Server, may be null if not configured.
     */
    public Optional<String> getDisplayName() {
        return displayName;
    }

    /* TEI, FoLiA, etc */
    public Optional<String> getCorpusDataFormat() {
        return corpusDataFormat;
    }


    private Optional<String> parseDisplayName() {
        Element root = (Element) config.getElementsByTagName("blacklabResponse").item(0);
        NodeList l = root.getChildNodes();
        for (int i = 0; i < l.getLength(); ++i) {
            Node n = l.item(i);
            if (n.getNodeName().equals("displayName")) {
            	return Optional.of(n.getTextContent());
            }
        }
        return Optional.empty();
    }

    private Optional<String> parseCorpusDataFormat() {
        NodeList documentFormatTags = config.getElementsByTagName("documentFormat");
        return Optional.ofNullable(documentFormatTags.getLength() > 0 ? StringUtils.trimToNull(documentFormatTags.item(0).getTextContent()) : null);
    }
  
    /**
     * Extract annotation ids for which we require the full list of values to be known by the frontend.
     *
     * Word properties can have a "uiType" property that determines if the input field should have
     * autocompletion enabled, use a dropdown list, be a number range, etc.
     * For the "select" value (e.g. a dropdown list) we need to get the possible values for that field from blacklab.
     * Since they aren't contained in the initial json payload unless we specifically request them.
     * This is also required for
     *
     * This function parses the config, finds the fields marked with "select", and returns a comma-separated list of the field names.
     * We can then use that list to request the config again, with the field values.
     *
     * @param xml the indexStructure/indexMetadata xml
     * @return comma-separated list of fields with uitype "select"
     * @throws ParserConfigurationException
     * @throws SAXException
     * @throws IOException
     * @throws XPathExpressionException
     */
    public static String getAnnotationsWithRequiredValues(String xml) throws ParserConfigurationException, SAXException, IOException {
        Document config = fromXml(xml);
        Set<String> annotations = new HashSet<>();

        // We can't just retrieve the annotatedField/complexField entries directly, as there are two types of
        // elements named annotatedField, one for the annotationGroups and one for the annotations themselves
        Element fieldContainerElement = (Element) config.getElementsByTagName("complexFields").item(0);
        if (fieldContainerElement == null) {
            fieldContainerElement = (Element) config.getElementsByTagName("annotatedFields").item(0);
        }

        NodeList annotatedFieldElements = fieldContainerElement.getElementsByTagName("complexField");
        if (annotatedFieldElements.getLength() == 0) {
            annotatedFieldElements = fieldContainerElement.getElementsByTagName("annotatedField"); // since blacklab 2.0
        }
        for (int cfi = 0; cfi < annotatedFieldElements.getLength(); cfi++) {
            Element annotatedFieldElement = (Element) annotatedFieldElements.item(cfi);
            NodeList propertyElements = annotatedFieldElement.getElementsByTagName("property");
            if (propertyElements.getLength() == 0) {
                propertyElements = annotatedFieldElement.getElementsByTagName("annotation"); // since blacklab 2.0
            }
            for (int ip = 0; ip < propertyElements.getLength(); ++ip) {
                Node propertyNode = propertyElements.item(ip);
                if (!(propertyNode instanceof Element))
                    continue;

                Element propertyElement = (Element) propertyNode;
                if (propertyElement.getElementsByTagName("isInternal").item(0).getTextContent().equalsIgnoreCase("true"))
                    continue;

                String configType = propertyElement.getElementsByTagName("uiType").getLength() == 1
                    ? propertyElement.getElementsByTagName("uiType").item(0).getTextContent()
                    : "";
                if ("select".equals(configType)) {
                    annotations.add(propertyElement.getAttribute("name"));
                } else if ("pos".equals(configType)) {
                    annotations.add(propertyElement.getAttribute("name"));
                    NodeList subAnnotations = propertyElement.getElementsByTagName("subannotation");
                    for (int i = 0; i < subAnnotations.getLength(); ++i) {
                        Element e = (Element) subAnnotations.item(i);
                        annotations.add(e.getTextContent());
                    }
                }
            }
        }

        // this is always required.
        annotations.add("starttag");
        return annotations.stream().collect(Collectors.joining(","));
    }
}
