package com.pda.admin.api;

import com.pda.admin.application.service.AdminAuthorization;
import com.pda.audit.AdminAuditLog;
import com.pda.audit.AuditAction;
import com.pda.audit.AuditOutcome;
import com.pda.audit.AuditTargetType;
import com.pda.user.PlatformPermission;
import com.pda.user.UserAccounts;
import com.pda.user.UserAdministration;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only view of the persistent audit trail. Ids, codes and times, plus the nickname of the accounts involved. */
@RestController
@RequestMapping("/api/v1/admin/audit-events")
public class AdminAuditController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_RANGE_DAYS = 800;

    private final AdminAuditLog audit;
    private final UserAdministration users;
    private final AdminAuthorization authorization;

    public AdminAuditController(AdminAuditLog audit, UserAdministration users, AdminAuthorization authorization) {
        this.audit = audit;
        this.users = users;
        this.authorization = authorization;
    }

    /**
     * {@code actorNickname} / {@code targetNickname} are display helpers: present only when the account is known and not
     * anonymised. An e-mail address is never part of an audit event.
     */
    public record AuditEventView(UUID id, Instant occurredAt, UUID actorUserId, String actorNickname,
                                 AuditAction action, AuditTargetType targetType, UUID targetId, String targetNickname,
                                 AuditOutcome outcome) {}

    public record AuditEventPage(List<AuditEventView> items, int page, int size, long totalElements) {}

    @GetMapping
    @Operation(summary = "List audit events",
            description = "ADMIN only (AUDIT_VIEW). Newest first, paged on the server (size clamped to 1..100). Optional "
                    + "filters: `action` (ADMIN_SIGN_IN, USER_DISABLE, USER_ENABLE, SESSION_REVOKE, SESSION_REVOKE_ALL, "
                    + "SUPPORT_REQUEST_STATUS_CHANGE) and an inclusive day range `from`..`to` cut in the IANA time zone "
                    + "`zone` (default UTC; at most 800 days). Events hold ids, codes and times only; nicknames are looked "
                    + "up for display.")
    @ApiResponse(responseCode = "200", description = "One page of audit events")
    @ApiResponse(responseCode = "400", description = "Unknown action or zone, inverted or over-long range")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    @ApiResponse(responseCode = "403", description = "Not an administrator, or the session is not administrator-verified")
    public ResponseEntity<AuditEventPage> list(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String zone) {
        authorization.require(principal, PlatformPermission.AUDIT_VIEW);
        ZoneId zoneId = zone(zone);
        if (from != null && to != null) {
            if (from.isAfter(to)) {
                throw new IllegalArgumentException("from must not be after to");
            }
            if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
                throw new IllegalArgumentException("The range is limited to " + MAX_RANGE_DAYS + " days");
            }
        }
        Instant start = from == null ? null : from.atStartOfDay(zoneId).toInstant();
        Instant end = to == null ? null : to.plusDays(1).atStartOfDay(zoneId).toInstant();
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        AdminAuditLog.AuditPage result = audit.list(action, start, end, Math.max(page, 0), pageSize);

        Set<UUID> ids = new HashSet<>();
        for (AdminAuditLog.AuditEvent event : result.items()) {
            if (event.actorUserId() != null) ids.add(event.actorUserId());
            if (event.targetType() == AuditTargetType.USER && event.targetId() != null) ids.add(event.targetId());
        }
        Map<UUID, String> nicknames = users.nicknames(ids);
        List<AuditEventView> items = result.items().stream().map(event -> new AuditEventView(event.id(),
                event.occurredAt(), event.actorUserId(), nickname(nicknames, event.actorUserId()), event.action(),
                event.targetType(), event.targetId(),
                event.targetType() == AuditTargetType.USER ? nickname(nicknames, event.targetId()) : null,
                event.outcome())).toList();
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(new AuditEventPage(items, result.page(), result.size(), result.totalElements()));
    }

    /** Map.of() rejects a null key, so the lookup is guarded. */
    private static String nickname(Map<UUID, String> nicknames, UUID id) {
        return id == null ? null : nicknames.get(id);
    }

    private static ZoneId zone(String id) {
        if (id == null || id.isBlank()) {
            return ZoneId.of("UTC");
        }
        String name = id.strip();
        if (name.length() > 64 || name.startsWith("SystemV") || !ZoneId.getAvailableZoneIds().contains(name)) {
            throw new IllegalArgumentException("Unknown time zone");
        }
        try {
            return ZoneId.of(name);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Unknown time zone", exception);
        }
    }
}
