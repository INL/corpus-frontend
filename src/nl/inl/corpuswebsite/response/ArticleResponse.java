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
	public void init(HttpServletRequest argRequest, HttpServletResponse argResponse,
			MainServlet argServlet) {
		super.init(argRequest, argResponse, argServlet);
		articleStylesheet = servlet.getArticleStylesheet();
		metadataStylesheet = servlet.getMetadataStylesheet();
	}

	/* (non-Javadoc)
	 * @see nl.inl.corpuswebsite.BaseResponse#completeRequest()
	 */
	@Override
	protected void completeRequest() {
		String pid = this.getParameter("doc", "");
		if (pid.length() > 0) {
			webservice = new QueryServiceHandler(this.servlet.getWebserviceUrl() + "docs/" + pid + "/contents");
			webserviceMeta = new QueryServiceHandler(this.servlet.getWebserviceUrl() + "docs/" + pid);
		}

		if (this.request.getParameterMap().size() > 0) {
			// get parameter values
			String query = this.getParameter("query", "");

			Map<String, String[]> parameters = UrlParameterFactory.getSourceParameters(query, null);
			try {
				String xmlResult = webservice.makeRequest(parameters);

				transformer.clearParameters();
				transformer.addParameter("source_images", this.servlet.getSourceImagesLocation());
				transformer.addParameter("title_name", this.servlet.getConfig().getFieldIndexForFunction("title"));
				String htmlResult = transformer.transform(xmlResult, articleStylesheet);

				this.getContext().put("article_content", htmlResult);

				Map<String, String[]> metaParam = new HashMap<String, String[]>();
				//metaParam.put("outputformat", new String[] {"xml"});
				xmlResult = webserviceMeta.makeRequest(metaParam);
				transformer.clearParameters();
				transformer.addParameter("title_name", this.servlet.getConfig().getFieldIndexForFunction("title"));
				htmlResult = transformer.transform(xmlResult, metadataStylesheet);
				this.getContext().put("article_meta", htmlResult);

			} catch (IOException e) {
				throw new RuntimeException(e);
			} catch (TransformerException e) {
				throw new RuntimeException(e);
			}
		}
		this.getContext().put("title", this.servlet.getConfig().getCorpusName());
		this.getContext().put("websiteconfig", this.servlet.getConfig());
		this.getContext().put("googleAnalyticsKey", this.servlet.getGoogleAnalyticsKey());

		// display template
		this.displayHtmlTemplate(this.servlet.getTemplate("article"));
	}

	/* (non-Javadoc)
	 * @see nl.inl.corpuswebsite.BaseResponse#logRequest()
	 */
	@Override
	protected void logRequest() {
		// TODO Auto-generated method stub

	}

	@Override
	public BaseResponse duplicate() {
		return new ArticleResponse();
	}

}
