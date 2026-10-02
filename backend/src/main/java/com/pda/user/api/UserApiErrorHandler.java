package com.pda.user.api;

import com.pda.user.application.service.ProfilePhotoException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.NoSuchElementException;

/** Safe, code-based answers for the user module's own endpoints; internal details never reach the client. */
@RestControllerAdvice(basePackages = "com.pda.user.api")
class UserApiErrorHandler {

    @ExceptionHandler(ProfilePhotoException.class)
    ResponseEntity<ProblemDetail> invalidPhoto(ProfilePhotoException exception) {
        return photoProblem(exception.code());
    }

    /** The servlet multipart limit trips before the service can measure the file. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> photoTooLarge() {
        return photoProblem(ProfilePhotoException.TOO_LARGE);
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    ResponseEntity<ProblemDetail> missingPhotoPart() {
        return photoProblem(ProfilePhotoException.EMPTY);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> invalidInput() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request");
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() {
        return problem(HttpStatus.NOT_FOUND, "Resource not found");
    }

    private static ResponseEntity<ProblemDetail> photoProblem(String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid profile photo");
        body.setProperty("code", code);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        return ResponseEntity.status(status).header("Cache-Control", "no-store")
                .body(ProblemDetail.forStatusAndDetail(status, detail));
    }
}
