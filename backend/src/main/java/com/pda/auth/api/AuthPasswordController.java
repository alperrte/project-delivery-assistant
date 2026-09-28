package com.pda.auth.api;

import com.pda.auth.api.dto.request.ChangePasswordRequest;
import com.pda.auth.api.dto.request.ForgotPasswordRequest;
import com.pda.auth.api.dto.request.ResetPasswordRequest;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.PasswordResetService;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lets an authenticated user replace their own password; also completes a forced first-login change. */
@RestController
@RequestMapping("/api/v1/auth/password")
public class AuthPasswordController {

    private final UserAccounts users;
    private final UserSessions sessions;
    private final JwtTokens tokens;
    private final AuthCookies cookies;
    private final Clock clock;
    private final PasswordResetService passwordReset;

    public AuthPasswordController(UserAccounts users, UserSessions sessions, JwtTokens tokens, AuthCookies cookies,
                                  Clock clock, PasswordResetService passwordReset) {
        this.users = users;
        this.sessions = sessions;
        this.tokens = tokens;
        this.cookies = cookies;
        this.clock = clock;
        this.passwordReset = passwordReset;
    }

    @PostMapping("/change")
    @Operation(summary = "Change my password",
            description = "Requires a valid access cookie and CSRF. Verifies the current password, stores the new BCrypt hash, clears a pending forced change and revokes every other session of the caller.")
    @ApiResponse(responseCode = "200", description = "Password changed; other sessions were revoked")
    @ApiResponse(responseCode = "400", description = "Invalid fields, wrong current password, confirmation mismatch or unchanged password")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    public ResponseEntity<Object> change(@Valid @RequestBody ChangePasswordRequest request,
                                         @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         HttpServletRequest servletRequest) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        return switch (users.changePassword(principal.id(), request.currentPassword(), request.newPassword())) {
            case CHANGED -> {
                // The security filter chain already authenticated this request from the same cookie.
                JwtTokens.AccessIdentity identity = tokens.parseAccess(cookies.access(servletRequest))
                        .orElseThrow(() -> new IllegalStateException("Authenticated request without access identity"));
                sessions.revokeOthers(principal.id(), identity.sessionId(), clock.instant());
                yield ResponseEntity.ok().header("Cache-Control", "no-store").build();
            }
            case WRONG_CURRENT_PASSWORD ->
                    problem(HttpStatus.BAD_REQUEST, "current_password_incorrect", "Current password is incorrect");
            case SAME_PASSWORD -> problem(HttpStatus.BAD_REQUEST, "password_unchanged",
                    "New password must differ from the current one");
            case ACCOUNT_UNAVAILABLE -> problem(HttpStatus.FORBIDDEN, "account_unavailable", "Account unavailable");
        };
    }

    @PostMapping("/forgot")
    @Operation(summary = "Request a password reset code",
            description = "Public with CSRF. Always returns 202 regardless of whether the email is registered, to avoid account enumeration; a 6-digit code is emailed only when it belongs to an active account.")
    @ApiResponse(responseCode = "202", description = "Accepted; a code was emailed if the account exists and is active")
    @ApiResponse(responseCode = "503", description = "Mail is temporarily unavailable")
    public ResponseEntity<Void> forgot(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordReset.forgot(request.email());
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/reset")
    @Operation(summary = "Reset my password with an emailed code",
            description = "Public with CSRF. Verifies the code from /forgot, sets the new password, revokes every session of the account and clears a pending forced change.")
    @ApiResponse(responseCode = "200", description = "Password reset; response has no body")
    @ApiResponse(responseCode = "400", description = "Invalid fields, wrong/expired code, confirmation mismatch or too many attempts")
    public ResponseEntity<Object> reset(@Valid @RequestBody ResetPasswordRequest request) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        return switch (passwordReset.reset(request.email(), request.code(), request.newPassword())) {
            case RESET -> ResponseEntity.ok().header("Cache-Control", "no-store").build();
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "reset_code_invalid", "Reset code is invalid");
            case EXPIRED -> problem(HttpStatus.BAD_REQUEST, "reset_code_expired", "Reset code has expired");
            case TOO_MANY_ATTEMPTS ->
                    problem(HttpStatus.BAD_REQUEST, "reset_too_many_attempts", "Too many attempts; request a new code");
        };
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
