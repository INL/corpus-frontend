package nl.inl.corpuswebsite.utils;

import javax.xml.transform.*;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import java.io.*;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

public class XslTransformer {

    /**
     * Threadsafe as long as you don't change Configuration, which we don't. See
     * https://saxonica.plan.io/boards/2/topics/5645.
     */
    private static final TransformerFactory FACTORY
            = TransformerFactory.newInstance("net.sf.saxon.TransformerFactoryImpl", XslTransformer.class.getClassLoader());

    private final Map<String, String> params = new HashMap<>();

    private final Transformer transformer;

    private static final Map<String, Templates> TEMPLATES = new HashMap<>();

    private Templates getTemplates(String id, Source sheet) {
        synchronized (TEMPLATES) {
            if (!TEMPLATES.containsKey(id)) {
                try {
                    TEMPLATES.put(id, FACTORY.newTemplates(sheet));
                } catch (TransformerConfigurationException ex) {
                    throw new RuntimeException(ex);
                }
            }
        }
        return TEMPLATES.get(id);

    }

    /**
     * returns Transformer from cached Templates or null
     *
     * @param id
     * @return
     */
    public static Transformer get(String id) throws TransformerConfigurationException {
        return TEMPLATES.get(id).newTransformer();
    }

    /**
     * clear Templates for id from cache
     * @param id
     * @return true when id was found and removed
     */
    public static boolean clear(String id) {
        return TEMPLATES.remove(id) != null;
    }

    public XslTransformer(File stylesheet) throws TransformerConfigurationException, FileNotFoundException {
        transformer = TEMPLATES.containsKey(stylesheet.getPath()) ? get(stylesheet.getPath()) : getTemplates(stylesheet.getPath(), new StreamSource(stylesheet)).newTransformer();
    }

    public XslTransformer(InputStream stylesheet) throws TransformerConfigurationException {
        transformer = FACTORY.newTransformer(new StreamSource(stylesheet));
    }

    public XslTransformer(Reader stylesheet) throws TransformerConfigurationException {
        transformer = FACTORY.newTransformer(new StreamSource(stylesheet));
    }

    /**
     * stylesheet is assumed to be a resource URI
     *
     * @param stylesheet
     * @throws TransformerConfigurationException
     */
    public XslTransformer(String stylesheet) throws TransformerConfigurationException {
        StreamSource streamSource = new StreamSource(stylesheet);
        transformer = TEMPLATES.containsKey(stylesheet) ? get(stylesheet) : getTemplates(stylesheet, streamSource).newTransformer();
    }

    public XslTransformer(String stylesheet, Reader sheet) throws TransformerConfigurationException {
        transformer = TEMPLATES.containsKey(stylesheet) ? get(stylesheet) : getTemplates(stylesheet, new StreamSource(sheet)).newTransformer();
    }

    public String transform(String source)
            throws TransformerException {
        StreamSource ssSource = new StreamSource(new StringReader(source));
        StringWriter result = new StringWriter();
        StreamResult streamResult = new StreamResult(result);

        synchronized (transformer) {
            for (Entry<String, String> e : params.entrySet()) {
                transformer.setParameter(e.getKey(), e.getValue());
            }

            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");
            transformer.transform(ssSource, streamResult);
            transformer.reset();
        }

        return result.toString();
    }

    public <W extends Writer> W streamTransform(Reader source, W result)
            throws TransformerException {
        StreamSource ssSource = new StreamSource(source);
        StreamResult streamResult = new StreamResult(result);

        synchronized (transformer) {
            for (Entry<String, String> e : params.entrySet()) {
                transformer.setParameter(e.getKey(), e.getValue());
            }

            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");
            transformer.transform(ssSource, streamResult);
            transformer.reset();
        }
        return result;

    }

    public void addParameter(String key, String value) {
        params.put(key, value);
    }

    public void clearParameters() {
        params.clear();
    }
}
