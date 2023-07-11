package org.ivdnt.cf.utils;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.Reader;
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.function.Function;

import javax.xml.transform.ErrorListener;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Templates;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;

import org.apache.commons.lang3.tuple.Pair;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.sf.saxon.trans.XPathException;

public class XslTransformer {
    private static final Logger logger = LoggerFactory.getLogger(XslTransformer.class);

    private static class CapturingErrorListener implements ErrorListener {
        private final List<Pair<String, Exception>> exceptions = new ArrayList<>();

        @Override
        public void error(TransformerException e) throws TransformerException {
            this.exceptions.add(Pair.of(this.getDescriptiveMessage(e), e));
        }

        @Override
        public void fatalError(TransformerException e) throws TransformerException {
            this.exceptions.add(Pair.of(this.getDescriptiveMessage(e), e));
        }

        @Override
        public void warning(TransformerException e) throws TransformerException {
            // just log these, no need to store them as errors
            logger.warn(getDescriptiveMessage(e), e);
        }

        public List<Pair<String, Exception>> getErrorList() {
            return this.exceptions;
        }

        private String getDescriptiveMessage(TransformerException e) {
            if (e instanceof TransformerConfigurationException) {
                final TransformerConfigurationException ee  = (TransformerConfigurationException) e;
                return ee.getMessageAndLocation();
            } else if (e instanceof XPathException) {
                XPathException ee = (XPathException) e;
                return ee.getErrorCodeLocalPart() + " in " + ee.getHostLanguage() + ": " + ee.getMessageAndLocation();
            } else {
                return e.getMessageAndLocation();
            }
        }
    }

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

    static {
        FACTORY.setErrorListener(new CapturingErrorListener());
    }

    /**
     * Constructs a new transformer (and templates if not cached and cache is enabled) and caches the templates if caching is enabled.
     *
     * @param id
     * @param source
     * @return
     * @throws TransformerConfigurationException
     */
    private static Transformer get(String id, StreamSource source) throws TransformerException {
//        boolean put = id != null && useCache && !TEMPLATES.containsKey(id);
//        boolean has = id != null && useCache && TEMPLATES.containsKey(id);

        synchronized (TEMPLATES) {
            try {
                FACTORY.setErrorListener(new CapturingErrorListener()); // renew to remove old exceptions
                Function<String, Templates> gen = __ -> { try { return FACTORY.newTemplates(source); } catch (TransformerException e) { throw new RuntimeException(e); } };
                Templates t = (useCache ? TEMPLATES.computeIfAbsent(id, gen) : gen.apply(id));
                return t.newTransformer();
            } catch (Exception e) {
                CapturingErrorListener l = (CapturingErrorListener) FACTORY.getErrorListener();
                if (!l.getErrorList().isEmpty()) {
                    throw new TransformerException(l.getErrorList().get(0).getLeft(), l.getErrorList().get(0).getRight());
                } else if (e instanceof TransformerException) {
                    throw (TransformerException) e;
                } else if (e.getCause() instanceof TransformerException) {
                    throw (TransformerException) e.getCause();
                } else {
                    throw new TransformerException(e.getMessage(), e);
                }
            }
        }
    }

    public XslTransformer(File stylesheet) throws FileNotFoundException, TransformerException {
        transformer = get(stylesheet.getAbsolutePath(), new StreamSource(stylesheet));
    }

    public XslTransformer(InputStream stylesheet) throws TransformerException {
        transformer = get(null, new StreamSource(stylesheet));
    }

    public XslTransformer(Reader stylesheet) throws TransformerException {
        transformer = get(null, new StreamSource(stylesheet));
    }

    /**
     * stylesheet is assumed to be a resource URI
     *
     * @param stylesheet
     * @throws TransformerException
     */
    public XslTransformer(String stylesheet) throws TransformerException {
        transformer = get(stylesheet, new StreamSource(stylesheet));
    }

    public XslTransformer(String stylesheet, Reader sheet) throws TransformerException {
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
