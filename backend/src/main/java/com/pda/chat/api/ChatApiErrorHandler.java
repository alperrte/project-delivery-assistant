package com.pda.chat.api;

import com.pda.chat.domain.ChatException;
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

/**
 * Bodies stay generic; the stable {@code code} property is what the frontend translates. Nothing from an exception
 * message, an entity, SQL or the message content ever reaches the client.
 */
@RestControllerAdvice(basePackages = "com.pda.chat")
public class ChatApiErrorHandler {

    @ExceptionHandler(ChatException.class)
    ResponseEntity<ProblemDetail> chat(ChatException exception) {
        return switch (exception.kind()) {
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "Invalid request", exception.code());
            case FORBIDDEN -> problem(HttpStatus.FORBIDDEN, "Access denied", exception.code());
            case NOT_FOUND -> problem(HttpStatus.NOT_FOUND, "Resource not found", exception.code());
            case RATE_LIMITED -> {
                ResponseEntity<ProblemDetail> response =
                        problem(HttpStatus.TOO_MANY_REQUESTS, "Too many messages", exception.code());
                yield ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Cache-Control", "no-store")
                        .header("Retry-After", "60").body(response.getBody());
            }
        };
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
            IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> invalidInput() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", "CHAT_INVALID_REQUEST");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() {
        return problem(HttpStatus.FORBIDDEN, "Access denied", "CHAT_FORBIDDEN");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> conflict() {
        return problem(HttpStatus.CONFLICT, "Chat change conflicts with existing state", "CHAT_CONFLICT");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
