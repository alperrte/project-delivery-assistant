package com.pda.squad.api;

import com.pda.squad.application.service.SquadConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.squad")
public class SquadApiErrorHandler {

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

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class})
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
        return problem(HttpStatus.CONFLICT, "Squad change conflicts with existing state");
    }

    /** Adds the stable {@code code} (and the affected member names) so the UI can explain the conflict. */
    @ExceptionHandler(SquadConflictException.class)
    ResponseEntity<ProblemDetail> squadConflict(SquadConflictException exception) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Squad change conflicts with existing state");
        if (exception.code() != null) body.setProperty("code", exception.code());
        if (!exception.members().isEmpty()) body.setProperty("members", exception.members());
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
