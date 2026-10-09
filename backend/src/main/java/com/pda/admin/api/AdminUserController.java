package com.pda.admin.api;

import com.pda.admin.application.service.AdminAuthorization;
import com.pda.user.PlatformPermission;
import com.pda.user.UserAccounts;
import com.pda.user.UserAdministration;
import com.pda.user.UserSessions;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform administrator user management. Never exposes password hashes, tokens or refresh hashes. */
@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_SEARCH_LENGTH = 100;

    private final UserAdministration administration;
    private final UserSessions sessions;
    private final AdminAuthorization authorization;
    private final Clock clock;

    public AdminUserController(UserAdministration administration, UserSessions sessions,
                               AdminAuthorization authorization, Clock clock) {
        this.administration = administration;
        this.sessions = sessions;
        this.authorization = authorization;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "List users",
            description = "ADMIN only. Paged on the server, newest first; size is clamped to 1..100. Optional `search` "
                    + "(email or nickname, case-insensitive substring, at most 100 characters) and `status` "
                    + "(PENDING_VERIFICATION, ACTIVE or DISABLED).")
    @ApiResponse(responseCode = "200", description = "One page of users")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    @ApiResponse(responseCode = "403", description = "Caller is not an administrator")
    public ResponseEntity<UserAdministration.UserPage> list(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search, @RequestParam(required = false) String status) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        if (search != null && search.length() > MAX_SEARCH_LENGTH) {
            throw new IllegalArgumentException("search is too long");
        }
        return noStore(administration.list(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE), search, status));
    }

    @GetMapping("/{userId}")
    @Operation(summary = "User detail", description = "ADMIN only. Includes linked providers and active session count.")
    @ApiResponse(responseCode = "200", description = "User detail")
    @ApiResponse(responseCode = "404", description = "User not found")
    public ResponseEntity<Object> detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         @PathVariable UUID userId) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        return administration.find(userId, clock.instant())
                .<ResponseEntity<Object>>map(this::noStore)
                .orElseGet(AdminUserController::notFound);
    }

    @PostMapping("/{userId}/disable")
    @Operation(summary = "Disable an account",
            description = "ADMIN only with CSRF. Revokes all sessions of the target. An administrator cannot disable self or the last active administrator.")
    @ApiResponse(responseCode = "200", description = "Account disabled (idempotent)")
    @ApiResponse(responseCode = "404", description = "User not found")
    @ApiResponse(responseCode = "409", description = "Self-disable or last active administrator")
    public ResponseEntity<Object> disable(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                          @PathVariable UUID userId) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        return status(administration.disable(principal.id(), userId, clock.instant()));
    }

    @PostMapping("/{userId}/enable")
    @Operation(summary = "Re-enable a disabled account", description = "ADMIN only with CSRF.")
    @ApiResponse(responseCode = "200", description = "Account enabled (idempotent)")
    @ApiResponse(responseCode = "404", description = "User not found")
    public ResponseEntity<Object> enable(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         @PathVariable UUID userId) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        return status(administration.enable(userId));
    }

    @GetMapping("/{userId}/sessions")
    @Operation(summary = "List a user's active sessions", description = "ADMIN only; no token material is returned.")
    @ApiResponse(responseCode = "200", description = "Active sessions")
    @ApiResponse(responseCode = "404", description = "User not found")
    public ResponseEntity<Object> listSessions(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                               @PathVariable UUID userId) {
        authorization.require(principal, PlatformPermission.SESSION_MANAGE);
        if (administration.find(userId, clock.instant()).isEmpty()) {
            return notFound();
        }
        List<UserSessions.SessionView> body = sessions.listActive(userId, clock.instant());
        return noStore(body);
    }

    @PostMapping("/{userId}/sessions/revoke-all")
    @Operation(summary = "Revoke all sessions of a user", description = "ADMIN only with CSRF.")
    @ApiResponse(responseCode = "200", description = "Number of sessions revoked")
    @ApiResponse(responseCode = "404", description = "User not found")
    public ResponseEntity<Object> revokeAll(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                            @PathVariable UUID userId) {
        authorization.require(principal, PlatformPermission.SESSION_MANAGE);
        if (administration.find(userId, clock.instant()).isEmpty()) {
            return notFound();
        }
        return noStore(new RevokedResponse(sessions.revokeAll(userId, clock.instant())));
    }

    @PostMapping("/{userId}/sessions/{sessionId}/revoke")
    @Operation(summary = "Revoke one session of a user", description = "ADMIN only with CSRF.")
    @ApiResponse(responseCode = "200", description = "Session revoked")
    @ApiResponse(responseCode = "404", description = "User or active session not found")
    public ResponseEntity<Object> revokeOne(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                            @PathVariable UUID userId, @PathVariable UUID sessionId) {
        authorization.require(principal, PlatformPermission.SESSION_MANAGE);
        if (!sessions.revokeById(userId, sessionId, clock.instant())) {
            return notFound();
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").build();
    }

    private ResponseEntity<Object> status(UserAdministration.StatusOutcome outcome) {
        return switch (outcome) {
            case CHANGED, UNCHANGED -> ResponseEntity.ok().header("Cache-Control", "no-store").build();
            case NOT_FOUND -> notFound();
            case SELF_DENIED -> conflict("Administrators cannot disable their own account", "ADMIN_SELF_DENIED");
            case LAST_ADMIN -> conflict("The last active administrator cannot be disabled", "ADMIN_LAST_ADMIN");
        };
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<Object> notFound() {
        return problem(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    private static ResponseEntity<Object> conflict(String detail, String code) {
        return problem(HttpStatus.CONFLICT, detail, code);
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }

    public record RevokedResponse(int revoked) {}
}
