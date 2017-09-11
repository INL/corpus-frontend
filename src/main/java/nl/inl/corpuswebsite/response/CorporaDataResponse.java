package nl.inl.corpuswebsite.response;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang.StringUtils;
import org.apache.log4j.lf5.util.StreamUtils;

import nl.inl.corpuswebsite.BaseResponse;

public class CorporaDataResponse extends BaseResponse {

	public CorporaDataResponse() {
		super(true, null);
	}

	@Override
	protected void completeRequest() {
		try {

			// we must decode every part of the path separately to avoid problems with url-encoded slashes and special characters
			Path path = Paths.get(".");
			for (String s : StringUtils.split(uriRemainder, "/")) {
				path = path.resolve(URLDecoder.decode(s, StandardCharsets.UTF_8.name()));
			}

			// TODO expose only specific subfolder of corpus folder and not root.
			String pathString = path.toString();

			try (InputStream is = servlet.getProjectFile(corpus, pathString, false)) {

				if (is == null) {
					response.sendError(HttpServletResponse.SC_NOT_FOUND);
					return;
				}
				String mime = servlet.getServletContext().getMimeType(pathString);
				response.setHeader("Cache-Control", "public, max-age=604800" /* 7 days */);
				response.setContentType(mime);

				StreamUtils.copy(is, response.getOutputStream());
				// TODO use filter
//				response.setHeader("expires", DateUtils.addDays(new Date(), 1) );
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
