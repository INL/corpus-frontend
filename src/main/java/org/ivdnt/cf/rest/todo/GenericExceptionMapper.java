package org.ivdnt.cf.rest.todo;

//import com.fasterxml.jackson.annotation.JsonProperty;
import org.glassfish.jersey.server.JSONP;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.ResponseBuilder;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonProperty;


/**
 * A catch-all for exceptions.
 * This class has specialized handling for some common exceptions.
 * The generated response will either contain a standard ResponseMessage detailing the error when the client requested JSON/XML/text,
 * or will contain the standard tomcat-generated page when the client requested HTML.
 */
public class GenericExceptionMapper implements ExceptionMapper<Exception> {

    private static final Logger logger = LoggerFactory.getLogger(GenericExceptionMapper.class);

    // An instance of @JSONP is required for jsonp support,
    // but we can't dynamically construct annotation instances, so instead get this via reflection.
    private interface AnnotationMixin {
        @JSONP(queryParam = "callback")
        public void fn();
    }

    @XmlRootElement(name="error")
    public static class ErrorDetails {
        @JsonProperty
        @XmlElement
        public int httpCode;
        @JsonProperty
        @XmlElement
        public String httpMessage;

        @JsonProperty
        @XmlElement
        public String message;
        @JsonProperty
        @XmlElement
        public String trace;

        private ErrorDetails() {        }
        public ErrorDetails(int httpCode, String httpMessage, String message, String trace) {
            this.httpCode = httpCode;
            this.httpMessage = httpMessage;
            this.message = message;
            this.trace = trace;
        }

        @Override
        public String toString() {
            return  "Http code: " + httpCode + "\n" +
                    "Http message: " + httpMessage + "\n" +
                    "Message: " + message + "\n" +
                    "Trace: " + trace;
        }

        public String toHTMLString() {
            return "<!doctype html><head></head><html><body><pre>"
                + ("Http code: " + httpCode + "\n"
                + "Http message: " + httpMessage + "\n"
                + "Message: " + message + "\n"
                + "Trace: " + trace).replaceAll("<", "&lt;").replaceAll(">", "&gt;")
                + "</pre></body></html>";
        }

        /** Get the correct entity for the given media type - i.e. one that can be serialized into the given media type */
        public Object getEntity(MediaType mediaType) {
            if (mediaType.isCompatible(MediaType.TEXT_HTML_TYPE)) return toHTMLString();
            else if (mediaType.isCompatible(MediaType.APPLICATION_JSON_TYPE) || mediaType.isCompatible(MediaType.APPLICATION_XML_TYPE)) return this;
            else if (mediaType.isCompatible(MediaType.TEXT_PLAIN_TYPE)) return toString();
            else return null;
        }
    }

    @Context
    private HttpHeaders headers;

    // In order of preference (most preferred first)
    private static Set<MediaType> supportedMediaTypes = new HashSet<>(Arrays.asList(
            MediaType.WILDCARD_TYPE,
            MediaType.APPLICATION_JSON_TYPE,
            new MediaType("application", "javascript"), // Required for JSONP detection, see JsonWithPaddingInterceptor
            MediaType.TEXT_XML_TYPE,
            MediaType.APPLICATION_XML_TYPE,
            MediaType.TEXT_HTML_TYPE,
            MediaType.TEXT_PLAIN_TYPE));

    public Response handleStandardJerseyException(WebApplicationException appEx, MediaType responseType) {
        Response resp = appEx.getResponse();
        if (resp.getStatus() >= 500)
            logger.error("Internal server error encountered", appEx);

        // tomcat's default response on a webapp exception is an html page
        // so if the client requested html, just return the original response.
        if (responseType.isCompatible(MediaType.TEXT_HTML_TYPE)) {
            return resp;
        }

        // The client doesn't want a standard html page, so we can't return the original response.
        // Generate a new response, with the correct media type, and the error details as entity.
        try {
            ErrorDetails details = new ErrorDetails(resp.getStatus(), resp.getStatusInfo().getReasonPhrase(), appEx.getMessage(), getStackTrace(appEx));
            return Response.fromResponse(appEx.getResponse()) // http code, headers etc. will be preserved.
                    .entity(details.getEntity(responseType), AnnotationMixin.class.getMethod("fn").getAnnotations())
                    .type(responseType)
                    .build();
        } catch (NoSuchMethodException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Response toResponse(Exception exception) {
        // Handle standard jersey exceptions, these are thrown when a page with an invalid url is requested,
        //	a page parameter contains an invalid value, etc.
        MediaType responseType = getAcceptType();
        if (exception instanceof WebApplicationException) {
            return handleStandardJerseyException((WebApplicationException) exception, responseType);
        }


        // If we're here, this is an actual unintended exception uncaught exception (other than a regular 404, 500, etc.)
        // serve up a reply containing some debug information

        logger.error("Internal server error encountered", exception);
        ResponseBuilder response = Response.status(Response.Status.INTERNAL_SERVER_ERROR);
        ErrorDetails details = new ErrorDetails(
                Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                Response.Status.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                exception.getMessage(),
                getStackTrace(exception)
        );

        try {
            return response
                .entity(details.getEntity(responseType), AnnotationMixin.class.getMethod("fn").getAnnotations())
                .type(responseType)
                .build();
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
            if (supportedMediaTypes.stream().anyMatch(type::isCompatible)) {
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