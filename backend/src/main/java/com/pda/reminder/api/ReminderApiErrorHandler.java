package com.pda.reminder.api;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.reminder")
public class ReminderApiErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidFields(MethodArgumentNotValidException exception) {
        List<String> fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField())
                .distinct()
                .sorted()
                .toList();
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid request fields");
        body.setProperty("invalidFields", fields);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    /** Unknown enum names, malformed dates/times, a missing range parameter and domain validation all land here. */
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> invalidInput() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request");
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() {
        return problem(HttpStatus.NOT_FOUND, "Resource not found");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() {
        return problem(HttpStatus.FORBIDDEN, "Access denied");
    }

    @ExceptionHandler({DataIntegrityViolationException.class, IllegalStateException.class})
    ResponseEntity<ProblemDetail> conflict() {
        return problem(HttpStatus.CONFLICT, "Reminder change conflicts with existing state");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
