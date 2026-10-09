package com.pda.analytics.api;

import com.pda.analytics.application.service.AnalyticsIngestService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.pda.analytics.api")
public class AnalyticsApiErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidFields(MethodArgumentNotValidException exception) {
        List<String> fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField()).distinct().sorted().toList();
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid request fields");
        body.setProperty("code", "ANALYTICS_INVALID");
        body.setProperty("invalidFields", fields);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    /** Unknown event types, malformed ids and unreadable JSON are all just an invalid event. */
    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class,
            AnalyticsIngestService.VisitorMismatchException.class})
    ResponseEntity<ProblemDetail> invalid() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid analytics event", "ANALYTICS_INVALID");
    }

    @ExceptionHandler(AnalyticsIngestService.UnknownSessionException.class)
    ResponseEntity<ProblemDetail> unknownSession() {
        return problem(HttpStatus.NOT_FOUND, "Unknown analytics session", "ANALYTICS_SESSION_UNKNOWN");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
