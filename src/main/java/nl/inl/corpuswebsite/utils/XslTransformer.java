/**
 *
 */
package nl.inl.corpuswebsite.utils;

import java.io.StringReader;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;

import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;

/**
 *
 */
public class XslTransformer {

	private TransformerFactory tFactory;
	private Map<String, String> params = new HashMap<>();

	public XslTransformer() {
		tFactory = TransformerFactory.newInstance();
	}

	public String transform(String source, String stylesheet)
			throws TransformerException {
		StreamSource ssSource = new StreamSource(new StringReader(source));
		StreamSource ssStylesheet = new StreamSource(new StringReader(
				stylesheet));
		StringWriter result = new StringWriter();
		StreamResult streamResult = new StreamResult(result);

		Transformer optimusPrime = tFactory.newTransformer(ssStylesheet);

		for (String key: params.keySet())
			optimusPrime.setParameter(key, params.get(key));

		optimusPrime.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
		optimusPrime.transform(ssSource, streamResult);

		return result.toString();
	}

	public void addParameter(String key, String value) {
		params.put(key, value);
	}

	public void clearParameters() {
		params.clear();
	}

}