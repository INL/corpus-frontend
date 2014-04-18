/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.util.Map;

import javax.xml.transform.TransformerException;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.QueryServiceHandler;
import nl.inl.corpuswebsite.utils.UrlParameterFactory;
import nl.inl.corpuswebsite.utils.XslTransformer;

/**
 *
 */
public class ArticleResponse extends BaseResponse {

	private QueryServiceHandler webservice = null;
	private XslTransformer transformer = new XslTransformer();
	private String articleStylesheet;

	/* (non-Javadoc)
	 * @see nl.inl.corpuswebsite.BaseResponse#completeRequest()
	 */
	@Override
	protected void completeRequest() {
		if(webservice == null)
			webservice = new QueryServiceHandler(this.servlet.getWebserviceUrl() + "source");

		if(this.request.getParameterMap().size() > 0) {
			// get parameter values
			String query = this.getParameter("query", "");
			int document = this.getParameter("doc", -1);

			// if the values seem like they could be usable
			if(document > -1) {

				Map<String, String[]> parameters = UrlParameterFactory.getSourceParameters(query, document, null);
				try {
					if(articleStylesheet == null) {
						String corpusDataFormat = this.servlet.getConfig().getCorpusDataFormat();
						articleStylesheet = this.getStylesheet("article_" + corpusDataFormat + ".xsl");
					}

					String xmlResult = webservice.makeRequest(parameters);

					transformer.clearParameters();
					transformer.addParameter("source_images", this.servlet.getSourceImagesLocation());
					transformer.addParameter("title_name", this.servlet.getConfig().getFieldIndexForFunction("title"));
					String htmlResult = transformer.transform(xmlResult, articleStylesheet);

					this.getContext().put("article_content", htmlResult);
				} catch (IOException e) {
					throw new RuntimeException(e);
				} catch (TransformerException e) {
					throw new RuntimeException(e);
				}
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
