package nl.inl.corpuswebsite.response;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

import nl.inl.corpuswebsite.BaseResponse;
import nl.inl.corpuswebsite.MainServlet;

public class CorporaDataResponse extends BaseResponse {

	public CorporaDataResponse() {
		super(false); // allow getting static files without corpus, this normally never happens, but we clear the corpus for /default/ static files
	}

	@Override
	public void init(HttpServletRequest request, HttpServletResponse response, MainServlet servlet, String corpus, String uriRemainder)
	    throws ServletException {

	    // Don't call super(), we don't always have a corpus to work with, and even if we do, it's not guaranteed to be valid
	    // (since we will retrieve the default fallback files in that case, and the BaseResponse is supposed to use a valid )

	    this.request = request;
	    this.response = response;
	    this.servlet = servlet;
	    this.corpus = corpus;
	    this.uriRemainder = uriRemainder;
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
			Optional<File> file = servlet.getProjectFile(corpus, pathString);

			if (!file.isPresent()) {
				try {
					response.sendError(HttpServletResponse.SC_NOT_FOUND);
					return;
				} catch (IOException e1) {
					throw new RuntimeException(e1);
				}
			}

			try (InputStream is = new FileInputStream(file.get())) {
				// Headers must be set before writing the response.
				String mime = servlet.getServletContext().getMimeType(pathString);
				response.setHeader("Cache-Control", "public, max-age=604800" /* 7 days */);
				response.setContentType(mime);

				IOUtils.copy(is, response.getOutputStream());
			} catch (IOException e) {
				// This signifies an error writing the response, errors reading the file are handled at a higher level.
				throw new RuntimeException(e);
			}
		} catch (InvalidPathException e1) { // runtimeException from Path.resolve; when weird paths are being requested
			try {
				response.sendError(HttpServletResponse.SC_NOT_FOUND);
				return;
			} catch (IOException e2) {
				throw new RuntimeException(e2);
			}
		} catch (UnsupportedEncodingException e) {
			throw new RuntimeException(e);
		}
	}
}
