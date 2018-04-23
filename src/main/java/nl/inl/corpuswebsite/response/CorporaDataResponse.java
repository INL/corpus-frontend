package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.BaseResponse;

public class CorporaDataResponse extends BaseResponse {

	public CorporaDataResponse() {
		super(true);
	}

	@Override
	protected void completeRequest() {
		try {

			// We must decode every part of the path separately to avoid problems with url-encoded slashes and special characters
			// NOTE: the corpus-specific directory can be used to store both internal and external files.
			// Internal files should be located in the root directory for the corpus interface-data directory
			// while external files (those available through the browser) should be located in the 'static' subdirectory.
			Path path = Paths.get("./static");
			for (String s : StringUtils.split(uriRemainder, "/")) {
				path = path.resolve(URLDecoder.decode(s, StandardCharsets.UTF_8.name()));
			}

			String pathString = path.toString();

			try (InputStream is = servlet.getProjectFile(corpus, pathString, false)) {

				if (is == null) {
					response.sendError(HttpServletResponse.SC_NOT_FOUND);
					return;
				}
				// Headers must be set before writing the response.
				String mime = servlet.getServletContext().getMimeType(pathString);
				response.setHeader("Cache-Control", "public, max-age=604800" /* 7 days */);
				response.setContentType(mime);

				IOUtils.copy(is, response.getOutputStream());
			}
		} catch (IOException e) {
			// This signifies an error writing the response, errors reading the file are handled at a higher level.
			throw new RuntimeException(e);
		} catch (InvalidPathException e) {
			try {
				response.sendError(HttpServletResponse.SC_NOT_FOUND);
				return;
			} catch (IOException e1) {
				throw new RuntimeException(e1);
			}
		}
	}
}
