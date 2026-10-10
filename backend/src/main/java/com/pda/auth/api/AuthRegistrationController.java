package com.pda.auth.api;

import com.pda.auth.api.dto.request.RegisterRequest;
import com.pda.auth.api.dto.request.ResendVerificationRequest;
import com.pda.auth.api.dto.request.VerifyRegistrationRequest;
import com.pda.auth.application.service.MailLocale;
import com.pda.auth.api.dto.request.InvitationRegisterRequest;
import com.pda.project.ProjectInvitationOnboarding;
import com.pda.auth.application.service.RegistrationWorkflow;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthRegistrationController {

    private final RegistrationWorkflow workflow;

    public AuthRegistrationController(RegistrationWorkflow workflow) {
        this.workflow = workflow;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Get the CSRF cookie and header name", description = "Public. The XSRF-TOKEN cookie value must be sent as X-XSRF-TOKEN on POST requests.")
    public ResponseEntity<Map<String, String>> csrf(CsrfToken token) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(Map.of("headerName", token.getHeaderName()));
    }

    @PostMapping("/register")
    @Operation(summary = "Register a local account", description = "Public with CSRF. Creates an account that cannot sign in yet and mails a 6-digit code (valid 15 minutes, single use). The registration is cancelled when the code is not used in time.")
    @ApiResponse(responseCode = "200", description = "Account created and code mailed; response has no body")
    @ApiResponse(responseCode = "409", description = "Email or nickname is unavailable")
    @ApiResponse(responseCode = "503", description = "Mail is temporarily unavailable; nothing was created")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        workflow.register(request.email(), request.nickname(), request.password(), request.confirmPassword(),
                MailLocale.from(request.locale()));
        return ResponseEntity.ok().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/register/verify")
    @Operation(summary = "Verify the registration code", description = "Public with CSRF. A correct code activates the account; it works once and only within 15 minutes. Five wrong guesses lock the code.")
    @ApiResponse(responseCode = "200", description = "Email verified; the visitor can now sign in")
    @ApiResponse(responseCode = "400", description = "verification_code_invalid, verification_code_expired or verification_too_many_attempts")
    public ResponseEntity<Object> verify(@Valid @RequestBody VerifyRegistrationRequest request) {
        return switch (workflow.verify(request.email(), request.code())) {
            case VERIFIED -> ResponseEntity.ok().header("Cache-Control", "no-store").build();
            case INVALID -> problem("verification_code_invalid", "Verification code is invalid");
            case EXPIRED -> problem("verification_code_expired", "Verification code has expired");
            case TOO_MANY_ATTEMPTS -> problem("verification_too_many_attempts", "Too many attempts; request a new code");
        };
    }

    @PostMapping("/register/resend")
    @Operation(summary = "Send a new registration code", description = "Public with CSRF. Always 202 so the answer never reveals whether an unverified registration exists; at most one mail per minute per account.")
    @ApiResponse(responseCode = "202", description = "Accepted; a new code was mailed when a pending registration exists")
    @ApiResponse(responseCode = "503", description = "Mail is temporarily unavailable")
    public ResponseEntity<Void> resend(@Valid @RequestBody ResendVerificationRequest request) {
        workflow.resend(request.email(), MailLocale.from(request.locale()));
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/register/invitation")
    @Operation(summary = "Register and join a project using an external invitation")
    public ResponseEntity<ProjectInvitationOnboarding.Accepted> registerInvitation(
            @Valid @RequestBody InvitationRegisterRequest request) {
        if (!request.passwordsMatch()) throw new PasswordConfirmationMismatchException();
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(workflow.registerWithInvitation(request.token(), request.email(), request.firstName(),
                        request.lastName(), request.nickname(), request.password(), request.confirmPassword()));
    }

    private static ResponseEntity<Object> problem(String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
        body.setProperty("code", code);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }
}
