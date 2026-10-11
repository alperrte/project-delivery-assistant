package com.pda.admin.api;

import com.pda.admin.application.service.AdminAuthorization;
import com.pda.audit.AdminAuditLog;
import com.pda.audit.AuditAction;
import com.pda.audit.AuditOutcome;
import com.pda.audit.AuditTargetType;
import com.pda.contact.SupportCategory;
import com.pda.contact.SupportRequests;
import com.pda.contact.SupportStatus;
import com.pda.user.PlatformPermission;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The support inbox: messages stored by the public contact form. They hold what visitors typed (name, e-mail address,
 * message), so every call needs the administrator-verified session and USER_MANAGE; nothing beyond the stored fields is
 * returned, nothing is logged but ids, and the only change an administrator can make is the handling status.
 */
@RestController
@RequestMapping("/api/v1/admin/support-requests")
public class AdminSupportController {

    private static final Logger log = LoggerFactory.getLogger(AdminSupportController.class);
    private static final int MAX_PAGE_SIZE = 100;

    private final SupportRequests support;
    private final AdminAuthorization authorization;
    private final AdminAuditLog audit;

    public AdminSupportController(SupportRequests support, AdminAuthorization authorization, AdminAuditLog audit) {
        this.support = support;
        this.authorization = authorization;
        this.audit = audit;
    }

    public record StatusRequest(SupportStatus status) {}

    @GetMapping
    @Operation(summary = "List support requests",
            description = "ADMIN only. Newest first, paged on the server (size clamped to 1..100). Optional `status` "
                    + "(NEW, IN_PROGRESS, CLOSED) and `category` (GENERAL, BUG, DATA_REQUEST, ACCESSIBILITY) filters; "
                    + "any other value is a 400. Each item carries a one-line message preview, not the full message.")
    @ApiResponse(responseCode = "200", description = "One page of support requests")
    @ApiResponse(responseCode = "400", description = "Unknown status or category")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    @ApiResponse(responseCode = "403", description = "Not an administrator, or the session is not administrator-verified")
    public ResponseEntity<SupportRequests.SupportPage> list(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) SupportStatus status,
            @RequestParam(required = false) SupportCategory category) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(support.list(status, category, Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Support request detail",
            description = "ADMIN only. The stored fields: category, name, e-mail address, message, handling status, "
                    + "status change time and mail delivery status (SENT or FAILED).")
    @ApiResponse(responseCode = "200", description = "The support request")
    @ApiResponse(responseCode = "404", description = "Unknown id (code SUPPORT_REQUEST_NOT_FOUND)")
    public ResponseEntity<Object> detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         @PathVariable UUID id) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        return support.find(id)
                .<ResponseEntity<Object>>map(found -> ResponseEntity.ok().header("Cache-Control", "no-store").body(found))
                .orElseGet(AdminSupportController::notFound);
    }

    @PostMapping("/{id}/status")
    @Operation(summary = "Change the handling status",
            description = "ADMIN only with CSRF. Body {\"status\": \"NEW\" | \"IN_PROGRESS\" | \"CLOSED\"}; any status may "
                    + "follow any other (a closed request can be reopened). Setting the current status is a no-op. A real "
                    + "change is written to the audit trail (SUPPORT_REQUEST_STATUS_CHANGE). Returns the updated request.")
    @ApiResponse(responseCode = "200", description = "The support request with its new status")
    @ApiResponse(responseCode = "400", description = "Missing or unknown status")
    @ApiResponse(responseCode = "404", description = "Unknown id (code SUPPORT_REQUEST_NOT_FOUND)")
    public ResponseEntity<Object> changeStatus(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                               @PathVariable UUID id, @RequestBody StatusRequest request) {
        authorization.require(principal, PlatformPermission.USER_MANAGE);
        if (request == null || request.status() == null) {
            throw new IllegalArgumentException("status is required");
        }
        SupportRequests.StatusChange change = support.changeStatus(id, request.status());
        switch (change) {
            case CHANGED -> {
                log.info("Support request status changed by administrator. actorId={} requestId={} status={}",
                        principal.id(), id, request.status());
                audit.record(AuditAction.SUPPORT_REQUEST_STATUS_CHANGE, principal.id(),
                        AuditTargetType.SUPPORT_REQUEST, id, AuditOutcome.SUCCESS);
            }
            case NOT_FOUND -> {
                audit.record(AuditAction.SUPPORT_REQUEST_STATUS_CHANGE, principal.id(),
                        AuditTargetType.SUPPORT_REQUEST, id, AuditOutcome.FAILURE);
                return notFound();
            }
            case UNCHANGED -> { }
        }
        return support.find(id)
                .<ResponseEntity<Object>>map(found -> ResponseEntity.ok().header("Cache-Control", "no-store").body(found))
                .orElseGet(AdminSupportController::notFound);
    }

    private static ResponseEntity<Object> notFound() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Support request not found");
        body.setProperty("code", "SUPPORT_REQUEST_NOT_FOUND");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).header("Cache-Control", "no-store").body(body);
    }
}
