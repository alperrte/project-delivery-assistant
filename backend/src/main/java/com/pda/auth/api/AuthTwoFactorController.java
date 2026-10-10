package com.pda.auth.api;

import com.pda.auth.api.dto.request.DisableTwoFactorRequest;
import com.pda.auth.api.dto.request.TwoFactorCodeRequest;
import com.pda.auth.application.service.LocalLoginService;
import com.pda.auth.application.service.TotpService;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticator-app two-factor sign-in: the account-settings switch (status, setup, enable, disable, backup codes)
 * and the second step of a sign-in. Secrets and backup codes are only ever returned by the call that creates them.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthTwoFactorController {

    private final TotpService twoFactor;
    private final LocalLoginService login;
    private final UserAccounts users;
    private final AuthCookies cookies;

    public AuthTwoFactorController(TotpService twoFactor, LocalLoginService login, UserAccounts users,
                                   AuthCookies cookies) {
        this.twoFactor = twoFactor;
        this.login = login;
        this.users = users;
        this.cookies = cookies;
    }

    public record StatusResponse(boolean available, boolean enabled, long recoveryCodesLeft, boolean passwordRequired) {}

    public record SetupResponse(String secret, String otpauthUri) {}

    public record RecoveryCodesResponse(List<String> recoveryCodes) {}

    @GetMapping("/2fa")
    @Operation(summary = "Two-factor status of my account",
            description = "Requires a valid access cookie. Never returns a secret. passwordRequired tells whether switching off needs the password (provider-only accounts have none).")
    @ApiResponse(responseCode = "200", description = "Status")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    public ResponseEntity<StatusResponse> status(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        TotpService.Status status = twoFactor.status(principal.id());
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(new StatusResponse(
                status.available(), status.enabled(), status.recoveryCodesLeft(), users.hasPassword(principal.id())));
    }

    @PostMapping("/2fa/setup")
    @Operation(summary = "Start the authenticator setup",
            description = "Requires a valid access cookie and CSRF. Creates (or replaces) a not-yet-confirmed secret and returns it once, as the otpauth URI for the QR code and as the typed-in key. Two-factor stays off until /2fa/enable.")
    @ApiResponse(responseCode = "200", description = "Secret and otpauth URI")
    @ApiResponse(responseCode = "409", description = "two_factor_already_enabled")
    @ApiResponse(responseCode = "503", description = "two_factor_unavailable: no TOTP_ENCRYPTION_KEY is configured")
    public ResponseEntity<Object> setup(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        Optional<TotpService.Setup> setup = twoFactor.beginSetup(principal.id(), principal.email());
        if (setup.isEmpty()) {
            return problem(HttpStatus.CONFLICT, "two_factor_already_enabled", "Two-factor is already enabled");
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(new SetupResponse(setup.get().secret(), setup.get().otpauthUri()));
    }

    @PostMapping("/2fa/enable")
    @Operation(summary = "Finish the authenticator setup",
            description = "Requires a valid access cookie and CSRF. The first 6-digit code from the app switches two-factor on and returns the ten single-use backup codes, once.")
    @ApiResponse(responseCode = "200", description = "Two-factor is on; backup codes returned")
    @ApiResponse(responseCode = "400", description = "two_factor_code_invalid")
    @ApiResponse(responseCode = "429", description = "two_factor_locked: five wrong codes, try again in 15 minutes")
    public ResponseEntity<Object> enable(@Valid @RequestBody TwoFactorCodeRequest request,
                                         @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        TotpService.Enabled enabled = twoFactor.enable(principal.id(), request.code());
        return switch (enabled.result()) {
            case OK -> ResponseEntity.ok().header("Cache-Control", "no-store")
                    .body(new RecoveryCodesResponse(enabled.recoveryCodes()));
            case INVALID -> codeInvalid();
            case LOCKED -> locked();
        };
    }

    @PostMapping("/2fa/disable")
    @Operation(summary = "Switch two-factor off",
            description = "Requires a valid access cookie and CSRF, the account password (when it has one) and a current authenticator or backup code.")
    @ApiResponse(responseCode = "200", description = "Two-factor is off; secret and backup codes were deleted")
    @ApiResponse(responseCode = "400", description = "current_password_incorrect or two_factor_code_invalid")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    public ResponseEntity<Object> disable(@Valid @RequestBody DisableTwoFactorRequest request,
                                          @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        UUID userId = principal.id();
        if (users.hasPassword(userId)
                && (request.password() == null || !users.passwordMatches(userId, request.password()))) {
            return problem(HttpStatus.BAD_REQUEST, "current_password_incorrect", "Current password is incorrect");
        }
        return switch (twoFactor.verify(userId, request.code())) {
            case OK -> {
                twoFactor.disable(userId);
                yield ResponseEntity.ok().header("Cache-Control", "no-store").build();
            }
            case INVALID -> codeInvalid();
            case LOCKED -> locked();
        };
    }

    @PostMapping("/2fa/recovery-codes")
    @Operation(summary = "Replace the backup codes",
            description = "Requires a valid access cookie and CSRF and a current authenticator code (a backup code is not accepted here). The old codes stop working at once.")
    @ApiResponse(responseCode = "200", description = "Ten new backup codes, shown once")
    @ApiResponse(responseCode = "400", description = "two_factor_code_invalid")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    public ResponseEntity<Object> recoveryCodes(@Valid @RequestBody TwoFactorCodeRequest request,
                                                @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return switch (twoFactor.verifyAuthenticatorCode(principal.id(), request.code())) {
            case OK -> ResponseEntity.ok().header("Cache-Control", "no-store")
                    .body(new RecoveryCodesResponse(twoFactor.regenerateRecoveryCodes(principal.id())));
            case INVALID -> codeInvalid();
            case LOCKED -> locked();
        };
    }

    @PostMapping("/login/2fa")
    @Operation(summary = "Finish a sign-in with the second factor",
            description = "Public with CSRF, but needs the PDA_MFA cookie that /login or the provider redirect set. An authenticator code or a backup code opens the session (HttpOnly access and refresh cookies); each code works once and five wrong ones lock the second factor for 15 minutes.")
    @ApiResponse(responseCode = "200", description = "Signed in; access and refresh cookies were set")
    @ApiResponse(responseCode = "400", description = "two_factor_code_invalid")
    @ApiResponse(responseCode = "401", description = "two_factor_session_expired: sign in with the password again")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    public ResponseEntity<Object> loginSecondFactor(@Valid @RequestBody TwoFactorCodeRequest request,
                                                    HttpServletRequest servletRequest,
                                                    HttpServletResponse servletResponse) {
        Optional<UUID> pending = cookies.secondFactorPending(servletRequest);
        if (pending.isEmpty()) {
            return problem(HttpStatus.UNAUTHORIZED, "two_factor_session_expired",
                    "The sign-in step expired; sign in again");
        }
        LocalLoginService.SecondFactorResult result = login.completeSecondFactor(
                pending.get(), request.code(), servletRequest.getHeader("User-Agent"));
        return switch (result.result()) {
            case OK -> {
                cookies.clearSecondFactorPending(servletRequest, servletResponse);
                cookies.write(result.tokens(), servletRequest, servletResponse);
                yield ResponseEntity.ok().header("Cache-Control", "no-store").body(Map.of("status", "SIGNED_IN"));
            }
            case INVALID -> codeInvalid();
            case LOCKED -> locked();
        };
    }

    private static ResponseEntity<Object> codeInvalid() {
        return problem(HttpStatus.BAD_REQUEST, "two_factor_code_invalid", "The code is not valid");
    }

    private static ResponseEntity<Object> locked() {
        return problem(HttpStatus.TOO_MANY_REQUESTS, "two_factor_locked",
                "Too many wrong codes; try again in 15 minutes");
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
