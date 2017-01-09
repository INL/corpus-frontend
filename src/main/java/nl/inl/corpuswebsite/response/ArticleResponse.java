/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

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

	private XslTransformer transformer = new XslTransformer();

	private String articleStylesheet;

	private String metadataStylesheet;

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		super.init(request, response, servlet);
		String corpusDataFormat = servlet.getConfig(corpus)
				.getCorpusDataFormat();
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
							+ "/contents", servlet);
			webserviceMeta = new QueryServiceHandler(
					servlet.getWebserviceUrl(corpus) + "docs/" + pid, servlet);
		}

		if (request.getParameterMap().size() > 0) {
			// get parameter values
			String query = this.getParameter("query", "");

			Map<String, String[]> parameters = UrlParameterFactory
					.getSourceParameters(query, null);
			parameters.put("wordend", new String[] {"5000"}); // show max. 5000 words of content (TODO: paging)
			try {
				String xmlResult = webservice.makeRequest(parameters);
				if (xmlResult.contains("NOT_AUTHORIZED")) {
					getContext().put("article_content", "");
				} else {
					transformer.clearParameters();
					transformer.addParameter("source_images",
							servlet.getSourceImagesLocation(corpus));
					transformer.addParameter(
							"title_name",
							servlet.getSpecialField(corpus, "title"));
					getContext()
							.put("article_content",
									transformer.transform(xmlResult,
											articleStylesheet));
				}

				Map<String, String[]> metaParam = new HashMap<>();
				// metaParam.put("outputformat", new String[] {"xml"});
				xmlResult = webserviceMeta.makeRequest(metaParam);
				transformer.clearParameters();
				transformer.addParameter("title_name", servlet.getSpecialField(corpus, "title"));
				String htmlResult = transformer.transform(xmlResult,
						metadataStylesheet);
				getContext().put("article_meta", htmlResult);

			} catch (IOException e) {
				throw new RuntimeException(e);
			} catch (TransformerException e) {
				throw new RuntimeException(e);
			}
		}
		// this.getContext().put("title",
		// this.servlet.getConfig(corpus).getCorpusName());
		// this.getContext().put("websiteconfig",
		// this.servlet.getConfig(corpus));
		// this.getContext().put("googleAnalyticsKey",
		// this.servlet.getGoogleAnalyticsKey());

		// display template
		displayHtmlTemplate(servlet.getTemplate("article"));
	}

}
