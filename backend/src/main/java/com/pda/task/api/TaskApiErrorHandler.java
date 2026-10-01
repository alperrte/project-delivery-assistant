package com.pda.task.api;

import com.pda.task.domain.TaskConflictException;
import com.pda.task.domain.TaskForbiddenException;
import com.pda.task.domain.TaskValidationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import java.util.NoSuchElementException;

/**
 * Bodies stay generic; the stable {@code code} property is what the frontend translates. Nothing from an exception
 * message, entity or SQL error ever reaches the client.
 */
@RestControllerAdvice(basePackages = "com.pda.task")
public class TaskApiErrorHandler {
    @ExceptionHandler(TaskValidationException.class)
    ResponseEntity<ProblemDetail> invalid(TaskValidationException exception) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", exception.code());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
            IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> badRequest() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", "TASK_INVALID_REQUEST");
    }

    /** The servlet multipart limit trips before the service can measure the file. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> tooLarge() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid attachment", "TASK_ATTACHMENT_TOO_LARGE");
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    ResponseEntity<ProblemDetail> missingPart() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid attachment", "TASK_ATTACHMENT_INVALID");
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() {
        return problem(HttpStatus.NOT_FOUND, "Resource not found", "TASK_NOT_FOUND");
    }

    @ExceptionHandler(TaskForbiddenException.class)
    ResponseEntity<ProblemDetail> forbiddenWithCode(TaskForbiddenException exception) {
        return problem(HttpStatus.FORBIDDEN, "Access denied", exception.code());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() {
        return problem(HttpStatus.FORBIDDEN, "Access denied", "TASK_FORBIDDEN");
    }

    @ExceptionHandler(TaskConflictException.class)
    ResponseEntity<ProblemDetail> conflict(TaskConflictException exception) {
        return problem(HttpStatus.CONFLICT, "Task operation conflicts with current state", exception.code());
    }

    @ExceptionHandler({DataIntegrityViolationException.class, ObjectOptimisticLockingFailureException.class})
    ResponseEntity<ProblemDetail> staleOrDuplicate() {
        return problem(HttpStatus.CONFLICT, "Task operation conflicts with current state", "TASK_CONFLICT");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
