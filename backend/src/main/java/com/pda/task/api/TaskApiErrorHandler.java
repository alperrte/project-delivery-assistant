package com.pda.task.api;

import com.pda.task.domain.TaskConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.task")
public class TaskApiErrorHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> badRequest() { return problem(HttpStatus.BAD_REQUEST, "Invalid request"); }
    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() { return problem(HttpStatus.NOT_FOUND, "Resource not found"); }
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() { return problem(HttpStatus.FORBIDDEN, "Access denied"); }
    @ExceptionHandler({TaskConflictException.class, DataIntegrityViolationException.class,
            ObjectOptimisticLockingFailureException.class})
    ResponseEntity<ProblemDetail> conflict() { return problem(HttpStatus.CONFLICT, "Task operation conflicts with current state"); }
    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        return ResponseEntity.status(status).header("Cache-Control", "no-store")
                .body(ProblemDetail.forStatusAndDetail(status, detail));
    }
}
