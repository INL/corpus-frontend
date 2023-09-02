package org.ivdnt.cf;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

/** Basically the same as a general exception, except we don't catch it. */
public class ReturnToClientException extends RuntimeException {

    private final HttpStatus code;
    private final String details;

    public ReturnToClientException(HttpStatus code) {
        this(code, code.getReasonPhrase(), null);
    }

    public ReturnToClientException(HttpStatus code, String message, String details) {
        super(message);
        this.code = code;
        this.details = details;
    }

    public ReturnToClientException(HttpStatus code, String message) {
        this(code, message, null);
    }

    public ProblemDetail getProblemDetail() {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(code, details);
        detail.setTitle(getMessage());
        detail.setProperty("trace", getStackTrace());
        return detail;
    }

    public HttpStatus getCode() {
    	return code;
    }
}
