package com.pda.auth.api;

import com.pda.auth.api.dto.request.LoginRequest;
import com.pda.auth.api.dto.request.TwoFactorCodeRequest;
import com.pda.auth.application.service.AdminAuthService;
import com.pda.auth.application.service.TotpService;
import com.pda.auth.infrastructure.config.AuthCookies;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The separate administrator sign-in ({@code /pd-admin}). The password alone never opens a session: it yields a
 * single-use ticket cookie, and only the authenticator step (or the first-time enrolment) opens the administrator-verified
 * session that the administrator API requires. Administrators cannot use {@code /auth/login} or the provider sign-in.
 */
@RestController
@RequestMapping("/api/v1/auth/admin")
public class AdminAuthController {

    private final AdminAuthService admin;
    private final AuthCookies cookies;

    public AdminAuthController(AdminAuthService admin, AuthCookies cookies) {
        this.admin = admin;
        this.cookies = cookies;
    }

    public record SetupResponse(String secret, String otpauthUri) {}

    @PostMapping("/login")
    @Operation(summary = "Administrator sign-in, password step",
            description = "Public with CSRF. Only an ACTIVE ADMIN with the right password gets past this step; every other case is the same 401 as a wrong password. No session or refresh token is issued: the answer is TWO_FACTOR_REQUIRED (confirmed authenticator; 5-minute PDA_ADMIN_MFA ticket cookie) or TWO_FACTOR_ENROLLMENT_REQUIRED (no confirmed authenticator yet; 10-minute PDA_ADMIN_ENROLL ticket cookie). Tickets are single use.")
    @ApiResponse(responseCode = "200", description = "{\"status\":\"TWO_FACTOR_REQUIRED\"} or {\"status\":\"TWO_FACTOR_ENROLLMENT_REQUIRED\"} plus the ticket cookie")
    @ApiResponse(responseCode = "401", description = "Invalid credentials (identical for unknown account, wrong password, not an administrator, disabled)")
    @ApiResponse(responseCode = "503", description = "two_factor_unavailable: no usable TOTP_ENCRYPTION_KEY; no ticket is issued")
    public ResponseEntity<Object> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest,
                                        HttpServletResponse servletResponse) {
        AdminAuthService.FirstFactor first = admin.login(request.email(), request.password());
        if (first.step() == AdminAuthService.NextStep.ENROLLMENT) {
            cookies.writeTicket(AuthCookies.ADMIN_ENROLL, AuthCookies.ADMIN_ENROLL_PATH, first.ticket(),
                    AdminAuthService.ENROLL_LIFETIME, servletRequest, servletResponse);
            return noStore(Map.of("status", "TWO_FACTOR_ENROLLMENT_REQUIRED"));
        }
        cookies.writeTicket(AuthCookies.ADMIN_MFA, AuthCookies.ADMIN_MFA_PATH, first.ticket(),
                AdminAuthService.MFA_LIFETIME, servletRequest, servletResponse);
        return noStore(Map.of("status", "TWO_FACTOR_REQUIRED"));
    }

    @PostMapping("/2fa/setup")
    @Operation(summary = "Administrator enrolment: start the authenticator setup",
            description = "Public with CSRF, but needs the PDA_ADMIN_ENROLL ticket cookie. Creates (or replaces) a not-yet-confirmed secret and returns it once as the otpauth URI for the QR code and as the typed-in key (Cache-Control: no-store). Two-factor stays off until /admin/2fa/enable. Does not use up the ticket.")
    @ApiResponse(responseCode = "200", description = "Secret and otpauth URI")
    @ApiResponse(responseCode = "401", description = "two_factor_session_expired: ticket missing, expired or used")
    @ApiResponse(responseCode = "503", description = "two_factor_unavailable")
    public ResponseEntity<Object> setup(HttpServletRequest servletRequest) {
        TotpService.Setup setup = admin.beginEnrollment(cookies.ticket(servletRequest, AuthCookies.ADMIN_ENROLL));
        return noStore(new SetupResponse(setup.secret(), setup.otpauthUri()));
    }

    @PostMapping("/2fa/enable")
    @Operation(summary = "Administrator enrolment: confirm with the first authenticator code",
            description = "Public with CSRF, needs the PDA_ADMIN_ENROLL ticket cookie. A right code switches two-factor on, returns the ten single-use backup codes once, uses up the ticket and opens the administrator-verified session (HttpOnly access and refresh cookies). A wrong code leaves two-factor off.")
    @ApiResponse(responseCode = "200", description = "{\"status\":\"SIGNED_IN\",\"recoveryCodes\":[...]}; access and refresh cookies were set")
    @ApiResponse(responseCode = "400", description = "two_factor_code_invalid")
    @ApiResponse(responseCode = "401", description = "two_factor_session_expired")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    public ResponseEntity<Object> enable(@Valid @RequestBody TwoFactorCodeRequest request,
                                         HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        AdminAuthService.Enrolled enrolled = admin.completeEnrollment(
                cookies.ticket(servletRequest, AuthCookies.ADMIN_ENROLL), request.code(),
                servletRequest.getHeader("User-Agent"));
        return switch (enrolled.result()) {
            case OK -> {
                cookies.clearTicket(AuthCookies.ADMIN_ENROLL, AuthCookies.ADMIN_ENROLL_PATH, servletRequest, servletResponse);
                cookies.write(enrolled.tokens(), servletRequest, servletResponse);
                yield noStore(Map.of("status", "SIGNED_IN", "recoveryCodes", List.copyOf(enrolled.recoveryCodes())));
            }
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "two_factor_code_invalid", "The code is not valid");
            case LOCKED -> locked();
        };
    }

    @PostMapping("/login/2fa")
    @Operation(summary = "Administrator sign-in, authenticator step",
            description = "Public with CSRF, needs the PDA_ADMIN_MFA ticket cookie. An authenticator code or a backup code uses up the ticket and opens the administrator-verified session (HttpOnly access and refresh cookies); five wrong codes lock the second factor for 15 minutes.")
    @ApiResponse(responseCode = "200", description = "{\"status\":\"SIGNED_IN\"}; access and refresh cookies were set")
    @ApiResponse(responseCode = "400", description = "two_factor_code_invalid")
    @ApiResponse(responseCode = "401", description = "two_factor_session_expired: sign in with the password again")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    @ApiResponse(responseCode = "503", description = "two_factor_unavailable")
    public ResponseEntity<Object> loginSecondFactor(@Valid @RequestBody TwoFactorCodeRequest request,
                                                    HttpServletRequest servletRequest,
                                                    HttpServletResponse servletResponse) {
        AdminAuthService.SignedIn signedIn = admin.completeSignIn(
                cookies.ticket(servletRequest, AuthCookies.ADMIN_MFA), request.code(),
                servletRequest.getHeader("User-Agent"));
        return switch (signedIn.result()) {
            case OK -> {
                cookies.clearTicket(AuthCookies.ADMIN_MFA, AuthCookies.ADMIN_MFA_PATH, servletRequest, servletResponse);
                cookies.write(signedIn.tokens(), servletRequest, servletResponse);
                yield noStore(Map.of("status", "SIGNED_IN"));
            }
            case INVALID -> problem(HttpStatus.BAD_REQUEST, "two_factor_code_invalid", "The code is not valid");
            case LOCKED -> locked();
        };
    }

    private static ResponseEntity<Object> locked() {
        return problem(HttpStatus.TOO_MANY_REQUESTS, "two_factor_locked", "Too many wrong codes; try again in 15 minutes");
    }

    private static ResponseEntity<Object> noStore(Object body) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
