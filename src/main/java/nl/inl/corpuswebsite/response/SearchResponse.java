/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;
import nl.inl.corpuswebsite.utils.CorpusConfig;

/**
 *
 */
public class SearchResponse extends BaseResponse {

	@Override
	protected void completeRequest() {

		String corpusName = servlet.getConfig(corpus).getCorpusName();

		String corpusNameTop = corpusName.replaceAll("^(.+):(.+)$", "$2 ($1)");
		String corpusOwner = null;
		if (corpusName.contains(":"))
			corpusOwner = corpusName.replaceAll(":.+$", "");
		corpusName = corpusName.replaceAll("^.+:", "");

		getContext().put("blsUrl", servlet.getExternalWebserviceUrl(corpus));
		getContext().put("title", corpusNameTop);
		getContext().put("corpusOwner", corpusOwner);
		getContext().put("corpusName", corpusName);

		for (Map.Entry<String, String> e : servlet.getCorpusConfig(corpus).getFieldInfo().entrySet()) {
			getContext().put(e.getKey(), e.getValue());
		}

		getContext().put("propertyFields", servlet.getCorpusConfig(corpus).getPropertyFields());
		getContext().put("metadataGroups", servlet.getCorpusConfig(corpus).getMetadataFieldGroups());
		getContext().put("defaultMetadataGroupName", CorpusConfig.GROUP_DEFAULT);
		// display template
		displayHtmlTemplate(servlet.getTemplate("search"));
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response,
			MainServlet servlet) {
		super.init(request, response, servlet);
	}
}
