package org.ivdnt.cf.rest.jersey;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.glassfish.jersey.server.JSONP;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;


/**
 * A catch-all for exceptions.
 * This class has specialized handling for some common exceptions.
 * The generated response will either contain a standard ResponseMessage detailing the error when the client requested JSON/XML/text,
 * or will contain the standard tomcat-generated page when the client requested HTML.
 */
public class GenericExceptionMapper implements javax.ws.rs.ext.ExceptionMapper<Exception> {

    // An instance of @JSONP is required for jsonp support,
    // but we can't dynamically construct annotation instances, so instead get this via reflection.
    private interface AnnotationMixin {
        @JSONP(queryParam = "callback")
        public void fn();
    }

    public static class ErrorDetails {
        @JsonProperty
        public int httpCode;
        @JsonProperty
        public String httpMessage;

        @JsonProperty
        public String message;
        @JsonProperty
        public String trace;

        public ErrorDetails(int httpCode, String httpMessage, String message, String trace) {
            this.httpCode = httpCode;
            this.httpMessage = httpMessage;
            this.message = message;
            this.trace = trace;
        }
    }

    @Context
    private HttpHeaders headers;

    private static Set<MediaType> supportedMediaTypes = new HashSet<>(Arrays.asList(
            MediaType.WILDCARD_TYPE,
            MediaType.APPLICATION_JSON_TYPE,
            new MediaType("application", "javascript"), // Required for JSONP detection, see JsonWithPaddingInterceptor
            MediaType.APPLICATION_XML_TYPE,
            MediaType.TEXT_HTML_TYPE,
            MediaType.TEXT_PLAIN_TYPE));

    @Override
    public Response toResponse(Exception exception) {
        MediaType responseType = getAcceptType();
        ErrorDetails details = null;
        ResponseBuilder response = null;


        // Handle standard jersey exceptions, these are thrown when a page with an invalid url is requested,
        //	a page parameter contains an invalid value, etc.
        if (exception instanceof WebApplicationException) {
            WebApplicationException appEx = (WebApplicationException) exception;

            if (appEx.getResponse().getStatus() < 200 || appEx.getResponse().getStatus() >= 300)
                exception.printStackTrace();

            // Preserve the original response, containing (among others) the http status code.
            response = Response.fromResponse(appEx.getResponse());

            Response resp = appEx.getResponse();
            details = new ErrorDetails(resp.getStatus(), resp.getStatusInfo().getReasonPhrase(), appEx.getMessage(), getStackTrace(appEx));

        } else {
            // If we're here, this is an uncaught exception other than a simple status relay
            // 	serve up a reply containing some debug information

            exception.printStackTrace();

            response = Response.status(Response.Status.INTERNAL_SERVER_ERROR);
            details =
                    new ErrorDetails(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                            Response.Status.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                            exception.getMessage(), getStackTrace(exception));
            // ExceptionUtils.getFullStackTrace(exception),
        }

        // By default every response without entity generates an html page
        // So if the client requested html, don't set the entity, and tomcat will generate a standard page detailing the error.
        try {
            if (!responseType.equals(MediaType.TEXT_HTML_TYPE))
                response.entity(details, AnnotationMixin.class.getMethod("fn").getAnnotations());
            else
                response.entity(null, AnnotationMixin.class.getMethod("fn").getAnnotations());

            return response.type(responseType).build();
        } catch (NoSuchMethodException | SecurityException e) {
            throw new RuntimeException(e);
        }
    }

    private MediaType getAcceptType() {
        // These are sorted with the most-suitable type first
        List<MediaType> accepts = headers.getAcceptableMediaTypes();

        // Find the first type we can produce, or default to JSON
        MediaType producedType = MediaType.APPLICATION_JSON_TYPE;
        for (MediaType type : accepts) {
            if (supportedMediaTypes.contains(type)) {
                producedType = type;
                break;
            }
        }

        // If the client accepts any type, return JSON
        if (producedType.equals(MediaType.WILDCARD_TYPE))
            producedType = MediaType.APPLICATION_JSON_TYPE;

        return producedType;
    }

    public static String getStackTrace(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }
}