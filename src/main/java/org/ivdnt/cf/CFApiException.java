package org.ivdnt.cf;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

public class CFApiException extends RuntimeException {

    private final HttpStatus code;
    private final String details;

    private CFApiException(Throwable cause, HttpStatus code, String details) {
        super(cause);
        this.code = code;
        this.details = details;
    }

    /** Create a new exception with the given message and status code */
    public CFApiException(HttpStatus code, String message) {
        this(code, message, null);
    }
    /** Create a new exception with the given message, status code and additional details. */
    public CFApiException(HttpStatus code, String message, String details) {
        super(message);
        this.code = code;
        this.details = details;
    }

    public ProblemDetail getProblemDetail() {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(code, details);
        detail.setTitle(getMessage());
        detail.setProperty("trace", ExceptionUtils.getStackTrace(ExceptionUtils.getRootCause(this)));
        return detail;
    }

    public HttpStatus getCode() {
        return code;
    }

    public String getDetails() {
        return details;
    }

    public static CFApiException wrap(Exception e) {
        return wrap(e, null);
    }

    /**
     *
     * @param e the exception that caused this one
     * @param details additional message to be added to the exception. May be null.
     * @return
     */
    public static CFApiException wrap(Exception e, String details) {
        if (e instanceof CFApiException) return (CFApiException) e;
        if (e instanceof ReturnToClientException) return new CFApiException(((ReturnToClientException) e).getCode(), e.getMessage(), details);
        return new CFApiException(e, HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
    }
}
