package com.pda.auth.api;

import com.pda.auth.api.dto.response.RevokedSessionsResponse;
import com.pda.auth.api.dto.response.SessionResponse;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserSessions;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lets an authenticated user inspect and revoke their own sessions. Never touches other users' sessions. */
@RestController
@RequestMapping("/api/v1/auth/sessions")
public class AuthSessionManagementController {

    private final UserSessions sessions;
    private final JwtTokens tokens;
    private final AuthCookies cookies;
    private final Clock clock;

    public AuthSessionManagementController(UserSessions sessions, JwtTokens tokens, AuthCookies cookies,
                                           Clock clock) {
        this.sessions = sessions;
        this.tokens = tokens;
        this.cookies = cookies;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "List my active sessions",
            description = "Requires a valid access cookie. Returns only the caller's active sessions, newest first; `current` marks the session of this request.")
    @ApiResponse(responseCode = "200", description = "Active sessions of the caller")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    public ResponseEntity<List<SessionResponse>> list(HttpServletRequest request) {
        JwtTokens.AccessIdentity identity = identity(request);
        List<SessionResponse> body = sessions.listActive(identity.userId(), clock.instant()).stream()
                .map(view -> new SessionResponse(view.id(), view.createdAt(), view.lastUsedAt(),
                        view.expiresAt(), view.userAgent(), view.id().equals(identity.sessionId())))
                .toList();
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    @PostMapping("/{sessionId}/revoke")
    @Operation(summary = "Revoke one of my sessions",
            description = "Requires a valid access cookie and CSRF. Revoking the current session also clears the auth cookies.")
    @ApiResponse(responseCode = "200", description = "Session revoked")
    @ApiResponse(responseCode = "404", description = "No active session with this id belongs to the caller")
    public ResponseEntity<Object> revoke(@PathVariable UUID sessionId, HttpServletRequest request,
                                         HttpServletResponse response) {
        JwtTokens.AccessIdentity identity = identity(request);
        if (!sessions.revokeById(identity.userId(), sessionId, clock.instant())) {
            ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Session not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).header("Cache-Control", "no-store").body(body);
        }
        if (sessionId.equals(identity.sessionId())) {
            cookies.clear(request, response);
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").build();
    }

    @PostMapping("/revoke-others")
    @Operation(summary = "Revoke all my other sessions",
            description = "Requires a valid access cookie and CSRF. Keeps the current session active.")
    @ApiResponse(responseCode = "200", description = "Number of sessions revoked")
    public ResponseEntity<RevokedSessionsResponse> revokeOthers(HttpServletRequest request) {
        JwtTokens.AccessIdentity identity = identity(request);
        int revoked = sessions.revokeOthers(identity.userId(), identity.sessionId(), clock.instant());
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(new RevokedSessionsResponse(revoked));
    }

    private JwtTokens.AccessIdentity identity(HttpServletRequest request) {
        // The security filter chain already authenticated this request from the same cookie.
        return tokens.parseAccess(cookies.access(request))
                .orElseThrow(() -> new IllegalStateException("Authenticated request without access identity"));
    }
}
