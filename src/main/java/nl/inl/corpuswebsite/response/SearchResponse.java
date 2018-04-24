/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.util.Map;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.utils.CorpusConfig;

public class SearchResponse extends BaseResponse {

	public SearchResponse() {
		super(true);
	}

	@Override
	protected void completeRequest() {
		context.put("blsUrl", servlet.getExternalWebserviceUrl(corpus));

		CorpusConfig config = servlet.getCorpusConfig(corpus);
		if (config == null) {
			try {
				response.sendError(404);
				return;
			} catch (IOException e) {
				// ...
			}
		}

		for (Map.Entry<String, String> e : config.getFieldInfo().entrySet()) {
			context.put(e.getKey(), e.getValue());
		}

		context.put("indexStructureJson", config.getJsonUnescaped());
		context.put("propertyFields", config.getPropertyFields());
		context.put("metadataGroups", config.getMetadataFieldGroups());
		context.put("ungroupedMetadataFields", config.getUngroupedMetadataFields());

		// display template
		displayHtmlTemplate(servlet.getTemplate("search"));
	}
}
