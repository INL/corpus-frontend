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

    private static boolean useCache = true;

    public static void setUseCache(boolean use) {
        useCache = use;
    }

    /**
     * Constructs a new transformer (and templates if not cached and cache is enabled) and caches the templates it caching is enabled.
     *
     * @param id
     * @param source
     * @return
     * @throws TransformerConfigurationException
     */
    private static Transformer get(String id, StreamSource source) throws TransformerConfigurationException {
        boolean put = id != null && useCache && !TEMPLATES.containsKey(id);
        boolean has = id != null && useCache && TEMPLATES.containsKey(id);

        synchronized (TEMPLATES) {
            if (has) {
                return TEMPLATES.get(id).newTransformer();
            }

            Templates t = FACTORY.newTemplates(source);
            if (put) {
                TEMPLATES.put(id, t);
            }
            return t.newTransformer();
        }
    }

    public XslTransformer(File stylesheet) throws TransformerConfigurationException, FileNotFoundException {
        transformer = get(stylesheet.getAbsolutePath(), new StreamSource(stylesheet));
    }

    public XslTransformer(InputStream stylesheet) throws TransformerConfigurationException {
        transformer = get(null, new StreamSource(stylesheet));
    }

    public XslTransformer(Reader stylesheet) throws TransformerConfigurationException {
        transformer = get(null, new StreamSource(stylesheet));
    }

    /**
     * stylesheet is assumed to be a resource URI
     *
     * @param stylesheet
     * @throws TransformerConfigurationException
     */
    public XslTransformer(String stylesheet) throws TransformerConfigurationException {
        transformer = get(stylesheet, new StreamSource(stylesheet));
    }

    public XslTransformer(String stylesheet, Reader sheet) throws TransformerConfigurationException {
        transformer = get(stylesheet, new StreamSource(sheet));
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
            //transformer.setOutputProperty(OutputKeys.INDENT, "yes");
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
