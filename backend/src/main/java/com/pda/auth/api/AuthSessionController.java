package com.pda.auth.api;

import com.pda.auth.api.dto.request.LoginRequest;
import com.pda.auth.application.service.InvalidRefreshTokenException;
import com.pda.auth.application.service.LocalLoginService;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthSessionController {

    private final LocalLoginService login;
    private final AuthCookies cookies;

    public AuthSessionController(LocalLoginService login, AuthCookies cookies) {
        this.login = login;
        this.cookies = cookies;
    }

    @PostMapping("/login")
    @Operation(summary = "Log in with email and password", description = "Public with CSRF. Issues HttpOnly access and refresh cookies.")
    @ApiResponse(responseCode = "200", description = "Login succeeded; access and refresh cookies were set")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest request,
                                      HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        cookies.write(login.login(request.email(), request.password(), servletRequest.getHeader("User-Agent")),
                servletRequest, servletResponse);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate the refresh token",
            description = "Public with CSRF; requires the PDA_REFRESH cookie. Issues new HttpOnly access and refresh cookies and invalidates the previous refresh token.")
    @ApiResponse(responseCode = "200", description = "Refresh succeeded; new access and refresh cookies were set")
    @ApiResponse(responseCode = "401", description = "Refresh token missing, invalid, expired or revoked; cookies were cleared")
    public ResponseEntity<Object> refresh(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        try {
            cookies.write(login.refresh(cookies.refresh(servletRequest)), servletRequest, servletResponse);
            return ResponseEntity.ok().build();
        } catch (InvalidRefreshTokenException exception) {
            cookies.clear(servletRequest, servletResponse);
            ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header("Cache-Control", "no-store").body(body);
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Log out", description = "Public and idempotent with CSRF. Revokes the current refresh session and clears cookies.")
    @ApiResponse(responseCode = "200", description = "Logout succeeded; authentication cookies were cleared")
    public ResponseEntity<Void> logout(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        login.logout(cookies.refresh(servletRequest));
        cookies.clear(servletRequest, servletResponse);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Get current account", description = "Requires a valid access cookie and active session.")
    public ResponseEntity<UserAccounts.AuthenticatedUser> me(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(principal);
    }
}
