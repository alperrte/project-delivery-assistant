package com.pda.notification.api;

import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.notification")
public class NotificationApiErrorHandler {
    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class})
    ResponseEntity<ProblemDetail> badRequest() { return problem(HttpStatus.BAD_REQUEST, "Invalid request"); }
    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() { return problem(HttpStatus.NOT_FOUND, "Notification not found"); }
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() { return problem(HttpStatus.FORBIDDEN, "Access denied"); }
    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        return ResponseEntity.status(status).header("Cache-Control", "no-store")
                .body(ProblemDetail.forStatusAndDetail(status, detail));
    }
}
