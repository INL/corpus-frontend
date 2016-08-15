/**
 *
 */
package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.InputStream;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.apache.velocity.VelocityContext;

import nl.inl.corpuswebsite.BaseResponse;

/** Show help page. */
public class HelpResponse extends BaseResponse {

	@Override
	protected void completeRequest() {
		try (InputStream is = servlet.getHelpPage(corpus)) {
			if (is != null) {
				context.put("content", StringUtils.join(IOUtils.readLines(is, "utf-8"), "\n"));
			}
		} catch (IOException e) {
			throw new RuntimeException(e);
		}

		VelocityContext context = getContext();
		String pathToTop = corpus.equals("autosearch") ? "." : "..";
		context.put("pathToTop", pathToTop);
		context.put("brandLink", corpus.equals("autosearch") ? pathToTop : "search");

		displayHtmlTemplate(servlet.getTemplate("contentpage"));
	}

}
