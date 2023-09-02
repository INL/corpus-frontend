package org.ivdnt.cf.rest;

import org.ivdnt.cf.CFApiException;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

// Any class that has @RestControllerAdvice will be picked up by Spring Boot
// So we just extend the base ResponseEntityExceptionHandler, which is a full-fledged handler already.
// And we register it by annotating it here.
// It will now handle all exceptions thrown by the controllers, and put them into a neat package in the response body according to rfc7807.
// We can also add specialized handler functions for our own exception types, should we need to.
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(CFApiException.class)
    ProblemDetail handleCFAPIException(CFApiException e) {
        return e.getProblemDetail();
    }
}
