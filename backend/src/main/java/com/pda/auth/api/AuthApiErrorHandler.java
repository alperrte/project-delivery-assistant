package com.pda.auth.api;

import com.pda.auth.application.service.VerificationMailUnavailableException;
import com.pda.auth.application.service.EmailNotVerifiedException;
import com.pda.auth.application.service.InvalidCredentialsException;
import com.pda.auth.application.service.TwoFactorUnavailableException;
import com.pda.user.UserRegistrationConflictException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.List;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.auth.api")
public class AuthApiErrorHandler {

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

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> invalidBody() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request body");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> invalidArgument() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request fields");
    }

    @ExceptionHandler(PasswordConfirmationMismatchException.class)
    ResponseEntity<ProblemDetail> passwordConfirmationMismatch() {
        ProblemDetail body =
                ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Password confirmation does not match");
        body.setProperty("code", "password_confirmation_mismatch");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(UserRegistrationConflictException.class)
    ResponseEntity<ProblemDetail> conflict() {
        return problem(HttpStatus.CONFLICT, "Account identity is unavailable");
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> invitationUnavailable() {
        return problem(HttpStatus.NOT_FOUND, "Invitation not found");
    }

    @ExceptionHandler(VerificationMailUnavailableException.class)
    ResponseEntity<ProblemDetail> mailUnavailable() {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "Verification mail is temporarily unavailable");
    }

    @ExceptionHandler(TwoFactorUnavailableException.class)
    ResponseEntity<ProblemDetail> twoFactorUnavailable() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Two-factor authentication is not available");
        body.setProperty("code", "two_factor_unavailable");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    ResponseEntity<ProblemDetail> emailNotVerified() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Email address is not verified");
        body.setProperty("code", "email_not_verified");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ProblemDetail> invalidCredentials() {
        return problem(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
