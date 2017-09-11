/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.util.Map;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;

/**
 *
 */
public class SearchResponse extends BaseResponse {

	public SearchResponse() {
		super(true, null);
	}

	@Override
	protected void completeRequest() {

		String corpusName = servlet.getConfig(corpus).getCorpusDisplayName();

		String corpusNameTop = corpusName.replaceAll("^(.+):(.+)$", "$2 ($1)");
		String corpusOwner = null;
		if (corpusName.contains(":"))
			corpusOwner = corpusName.replaceAll(":.+$", "");
		corpusName = corpusName.replaceAll("^.+:", "");

		context.put("blsUrl", servlet.getExternalWebserviceUrl(corpus));
		context.put("title", corpusNameTop);
		context.put("corpusOwner", corpusOwner);
		context.put("corpusName", corpusName);

		CorpusConfig config = servlet.getCorpusConfig(corpus);
		for (Map.Entry<String, String> e : config.getFieldInfo().entrySet()) {
			context.put(e.getKey(), e.getValue());
		}

		context.put("propertyFields", config.getPropertyFields());
		context.put("metadataGroups", config.getMetadataFieldGroups());
		context.put("ungroupedMetadataFields", config.getUngroupedMetadataFields());

		// display template
		displayHtmlTemplate(servlet.getTemplate("search"));
	}
}
