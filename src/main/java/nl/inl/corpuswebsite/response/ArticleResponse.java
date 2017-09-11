/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.transform.TransformerException;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.UrlParameterFactory;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 *
 */
public class ArticleResponse extends BaseResponse {

	/** For getting article */
	private QueryServiceHandler webservice = null;

	/** For getting metadata */
	private QueryServiceHandler webserviceMeta;

	// TODO add properties from search.xml
	private XslTransformer transformer = new XslTransformer();

	private String articleStylesheet;

	private String metadataStylesheet;


	public ArticleResponse() {
		super(true, null);
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response, MainServlet servlet, String corpus, String contextPathAbsolute, String uriRemainder) throws ServletException {
		super.init(request, response, servlet, corpus, contextPathAbsolute, uriRemainder);
		String corpusDataFormat = servlet.getCorpusConfig(corpus).getCorpusDataFormat();
		articleStylesheet = servlet.getStylesheet(corpus, "article_"
				+ corpusDataFormat + ".xsl");
		metadataStylesheet = servlet.getStylesheet(corpus, "article_meta.xsl");
	}

	@Override
	protected void completeRequest() {
		String pid = this.getParameter("doc", "");
		if (pid.length() > 0) {
			webservice = new QueryServiceHandler(
					servlet.getWebserviceUrl(corpus) + "docs/" + pid
							+ "/contents");
			webserviceMeta = new QueryServiceHandler(
					servlet.getWebserviceUrl(corpus) + "docs/" + pid);
		}

		if (request.getParameterMap().size() > 0) {
			// get parameter values
			String query = this.getParameter("query", "");

			Map<String, String[]> parameters = UrlParameterFactory
					.getSourceParameters(query, null);
			parameters.put("wordend", new String[] {"5000"}); // show max. 5000 words of content (TODO: paging)
            String userId = null;
            if (this.corpus.contains(":")) {
                userId = this.corpus.split(":")[0];
            }
            if (userId != null) {
                parameters.put("userid", new String[] { userId });
            }
			try {
				String xmlResult = webservice.makeRequest(parameters);
				if (xmlResult.contains("NOT_AUTHORIZED")) {
					context.put("article_content", "");
				} else {
					transformer.clearParameters();
					transformer.addParameter("contextRoot", servlet.getServletContext().getContextPath());

					for (Entry<String, String> e : servlet.getWebsiteConfig(corpus).getXsltParameters().entrySet()) {
						transformer.addParameter(e.getKey(), e.getValue());
					}

					context.put("article_content", transformer.transform(xmlResult, articleStylesheet));
				}

				Map<String, String[]> metaParam = new HashMap<>();
				// metaParam.put("outputformat", new String[] {"xml"});
                if (userId != null) {
                    metaParam.put("userid", new String[] { userId });
                }
				xmlResult = webserviceMeta.makeRequest(metaParam);
				transformer.clearParameters();
				String htmlResult = transformer.transform(xmlResult, metadataStylesheet);
				context.put("article_meta", htmlResult);

			} catch (IOException e) {
				throw new RuntimeException(e);
			} catch (TransformerException e) {
				throw new RuntimeException(e);
			}
		}

		// display template
		displayHtmlTemplate(servlet.getTemplate("article"));
	}

}
