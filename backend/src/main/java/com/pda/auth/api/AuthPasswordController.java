package com.pda.auth.api;

import com.pda.auth.api.dto.request.ChangePasswordRequest;
import com.pda.auth.api.dto.request.ForgotPasswordRequest;
import com.pda.auth.api.dto.request.PasswordChangeCodeRequest;
import com.pda.auth.api.dto.request.ResetPasswordRequest;
import com.pda.auth.api.dto.request.VerifyChangeCodeRequest;
import com.pda.auth.api.dto.request.VerifyResetCodeRequest;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.MailLocale;
import com.pda.auth.application.service.PasswordChangeCodeService;
import com.pda.auth.application.service.PasswordResetService;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Password flows: an authenticated user replaces their own password (behind a mailed code, except the forced
 * first-login change), and the public three-step forgot-password flow.
 */
@RestController
@RequestMapping("/api/v1/auth/password")
public class AuthPasswordController {

    private static final String RESET_PURPOSE = "pwd_reset";
    private static final Duration RESET_TICKET_LIFETIME = Duration.ofMinutes(10);
    private static final String CHANGE_PURPOSE = "pwd_change";
    private static final Duration CHANGE_TICKET_LIFETIME = Duration.ofMinutes(10);

    private final UserAccounts users;
    private final UserSessions sessions;
    private final JwtTokens tokens;
    private final AuthCookies cookies;
    private final Clock clock;
    private final PasswordResetService passwordReset;
    private final PasswordChangeCodeService changeCodes;

    public AuthPasswordController(UserAccounts users, UserSessions sessions, JwtTokens tokens, AuthCookies cookies,
                                  Clock clock, PasswordResetService passwordReset,
                                  PasswordChangeCodeService changeCodes) {
        this.users = users;
        this.sessions = sessions;
        this.tokens = tokens;
        this.cookies = cookies;
        this.clock = clock;
        this.passwordReset = passwordReset;
        this.changeCodes = changeCodes;
    }

    @PostMapping("/change/code")
    @Operation(summary = "Mail the code that unlocks the password change",
            description = "Requires a valid access cookie and CSRF. Sends a 6-digit code (valid 15 minutes, five guesses) to the signed-in account's e-mail address. A request inside the 60-second cooldown is a silent no-op.")
    @ApiResponse(responseCode = "202", description = "Accepted; a code was mailed unless the cooldown applies")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    @ApiResponse(responseCode = "503", description = "Mail is temporarily unavailable")
    public ResponseEntity<Void> sendChangeCode(@Valid @RequestBody PasswordChangeCodeRequest request,
                                               @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        changeCodes.send(principal.id(), principal.email(), MailLocale.from(request.locale()));
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/change/verify")
    @Operation(summary = "Check the password change code",
            description = "Requires a valid access cookie and CSRF. A correct code is consumed and answered with a 10-minute HttpOnly PDA_PWCHANGE ticket cookie that /change requires.")
    @ApiResponse(responseCode = "200", description = "Code accepted; the ticket cookie was set")
    @ApiResponse(responseCode = "400", description = "change_code_invalid, change_code_expired or change_too_many_attempts")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    public ResponseEntity<Object> verifyChangeCode(@Valid @RequestBody VerifyChangeCodeRequest request,
                                                   @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                   HttpServletRequest servletRequest, HttpServletResponse response) {
        PasswordChangeCodeService.CodeCheck check = changeCodes.verify(principal.id(), request.code());
        return switch (check.result()) {
            case VERIFIED -> {
                JwtTokens.IssuedToken ticket = tokens.issueTicket(principal.id(), CHANGE_PURPOSE, check.ticketRef(),
                        CHANGE_TICKET_LIFETIME);
                cookies.writeTicket(AuthCookies.CHANGE_TICKET, AuthCookies.CHANGE_TICKET_PATH, ticket,
                        CHANGE_TICKET_LIFETIME, servletRequest, response);
                yield ResponseEntity.ok().header("Cache-Control", "no-store").build();
            }
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "change_code_invalid", "Verification code is invalid");
            case EXPIRED -> problem(HttpStatus.BAD_REQUEST, "change_code_expired", "Verification code has expired");
            case TOO_MANY_ATTEMPTS -> problem(HttpStatus.BAD_REQUEST, "change_too_many_attempts",
                    "Too many attempts; request a new code");
        };
    }

    @PostMapping("/change")
    @Operation(summary = "Change my password",
            description = "Requires a valid access cookie and CSRF, and (except for the forced first-login change) the PDA_PWCHANGE ticket from /change/verify. Verifies the current password, stores the new BCrypt hash, spends the ticket, clears a pending forced change and revokes every other session of the caller.")
    @ApiResponse(responseCode = "200", description = "Password changed; other sessions were revoked")
    @ApiResponse(responseCode = "400", description = "Invalid fields, wrong current password, confirmation mismatch or unchanged password")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    @ApiResponse(responseCode = "403", description = "verification_required: the mailed code was not entered (or its ticket expired)")
    public ResponseEntity<Object> change(@Valid @RequestBody ChangePasswordRequest request,
                                         @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         HttpServletRequest servletRequest, HttpServletResponse response) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        // The forced first-login change is exempt: that account (e.g. one created by an administrator) may not own
        // a real mailbox yet, and the temporary password was already proof of the person at the keyboard.
        Optional<JwtTokens.Ticket> ticket = principal.mustChangePassword() ? Optional.empty()
                : tokens.parseTicket(cookies.ticket(servletRequest, AuthCookies.CHANGE_TICKET), CHANGE_PURPOSE)
                        .filter(t -> t.userId().equals(principal.id()));
        if (!principal.mustChangePassword()
                && (ticket.isEmpty() || !changeCodes.ticketUsable(principal.id(), ticket.get().ref()))) {
            return problem(HttpStatus.FORBIDDEN, "verification_required",
                    "Enter the code sent to your e-mail address first");
        }
        return switch (users.changePassword(principal.id(), request.currentPassword(), request.newPassword())) {
            case CHANGED -> {
                // The security filter chain already authenticated this request from the same cookie.
                JwtTokens.AccessIdentity identity = tokens.parseAccess(cookies.access(servletRequest))
                        .orElseThrow(() -> new IllegalStateException("Authenticated request without access identity"));
                sessions.revokeOthers(principal.id(), identity.sessionId(), clock.instant());
                ticket.ifPresent(t -> changeCodes.complete(principal.id(), t.ref()));
                cookies.clearTicket(AuthCookies.CHANGE_TICKET, AuthCookies.CHANGE_TICKET_PATH, servletRequest, response);
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
        passwordReset.forgot(request.email(), MailLocale.from(request.locale()));
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/reset/verify")
    @Operation(summary = "Check the password reset code",
            description = "Public with CSRF. A correct code is consumed (it cannot be used again) and answered with a 10-minute HttpOnly ticket cookie that allows exactly one /reset call. Five wrong guesses lock the code.")
    @ApiResponse(responseCode = "200", description = "Code accepted; the PDA_RESET ticket cookie was set")
    @ApiResponse(responseCode = "400", description = "reset_code_invalid, reset_code_expired or reset_too_many_attempts")
    public ResponseEntity<Object> verifyResetCode(@Valid @RequestBody VerifyResetCodeRequest request,
                                                  HttpServletRequest servletRequest, HttpServletResponse response) {
        PasswordResetService.CodeCheck check = passwordReset.verifyCode(request.email(), request.code());
        return switch (check.result()) {
            case RESET -> {
                JwtTokens.IssuedToken ticket = tokens.issueTicket(check.userId(), RESET_PURPOSE, check.ticketRef(),
                        RESET_TICKET_LIFETIME);
                cookies.writeTicket(AuthCookies.RESET_TICKET, AuthCookies.RESET_TICKET_PATH, ticket,
                        RESET_TICKET_LIFETIME, servletRequest, response);
                yield ResponseEntity.ok().header("Cache-Control", "no-store").build();
            }
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "reset_code_invalid", "Reset code is invalid");
            case EXPIRED -> problem(HttpStatus.BAD_REQUEST, "reset_code_expired", "Reset code has expired");
            case TOO_MANY_ATTEMPTS ->
                    problem(HttpStatus.BAD_REQUEST, "reset_too_many_attempts", "Too many attempts; request a new code");
        };
    }

    @PostMapping("/reset")
    @Operation(summary = "Set a new password after the reset code was accepted",
            description = "Public with CSRF, but needs the PDA_RESET ticket cookie from /reset/verify. Works once, sets the new password, revokes every session of the account and clears a pending forced change.")
    @ApiResponse(responseCode = "200", description = "Password reset; response has no body")
    @ApiResponse(responseCode = "400", description = "Invalid fields, confirmation mismatch, or reset_ticket_invalid (missing, expired or already used ticket)")
    public ResponseEntity<Object> reset(@Valid @RequestBody ResetPasswordRequest request,
                                        HttpServletRequest servletRequest, HttpServletResponse response) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        Optional<JwtTokens.Ticket> ticket = tokens.parseTicket(
                cookies.ticket(servletRequest, AuthCookies.RESET_TICKET), RESET_PURPOSE);
        if (ticket.isEmpty() || passwordReset.reset(ticket.get().userId(), ticket.get().ref(), request.newPassword())
                != PasswordResetService.ResetResult.RESET) {
            return problem(HttpStatus.BAD_REQUEST, "reset_ticket_invalid", "Reset session is invalid or has expired");
        }
        cookies.clearTicket(AuthCookies.RESET_TICKET, AuthCookies.RESET_TICKET_PATH, servletRequest, response);
        return ResponseEntity.ok().header("Cache-Control", "no-store").build();
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
