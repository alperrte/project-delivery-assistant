package com.pda.auth.api;

import com.pda.auth.api.dto.request.RegisterRequest;
import com.pda.auth.application.service.RegistrationWorkflow;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.Map;
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
    @Operation(summary = "Register a local account", description = "Public with CSRF. Creates an active account while email verification is deferred.")
    @ApiResponse(responseCode = "200", description = "Account registered; response has no body")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request) {
        if (!request.passwordsMatch()) {
            throw new PasswordConfirmationMismatchException();
        }
        workflow.register(request.email(), request.nickname(), request.password(), request.confirmPassword());
        return ResponseEntity.ok().header("Cache-Control", "no-store").build();
    }

}
