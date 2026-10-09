package com.pda.contact.api;

import com.pda.contact.application.service.ContactMailPort.ContactDeliveryException;
import com.pda.contact.application.service.ContactMessage.InvalidContactException;
import com.pda.contact.application.service.ContactService.ContactDuplicateException;
import com.pda.contact.application.service.ContactService.ContactUnavailableException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Answers carry a stable {@code code} and never any mail-server detail. */
@RestControllerAdvice(basePackages = "com.pda.contact.api")
public class ContactApiErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(ContactApiErrorHandler.class);

    @ExceptionHandler(InvalidContactException.class)
    ResponseEntity<ProblemDetail> invalidFields(InvalidContactException exception) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid request fields");
        body.setProperty("code", "CONTACT_INVALID");
        body.setProperty("invalidFields", List.copyOf(exception.fields()));
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> unreadable() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request body", "CONTACT_INVALID");
    }

    @ExceptionHandler(ContactDuplicateException.class)
    ResponseEntity<ProblemDetail> duplicate() {
        return problem(HttpStatus.CONFLICT, "This message was just sent", "CONTACT_DUPLICATE");
    }

    @ExceptionHandler(ContactUnavailableException.class)
    ResponseEntity<ProblemDetail> unavailable() {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "The contact form is temporarily unavailable", "CONTACT_UNAVAILABLE");
    }

    @ExceptionHandler(ContactDeliveryException.class)
    ResponseEntity<ProblemDetail> deliveryFailed(ContactDeliveryException exception) {
        // The cause stays in the log only; the browser learns nothing about the mail server.
        log.warn("Contact message was not delivered: {}", exception.getCause() == null
                ? "unknown" : exception.getCause().getClass().getSimpleName());
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "The message could not be delivered", "CONTACT_DELIVERY_FAILED");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
