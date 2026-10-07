package com.pda.notification.api;

import com.pda.notification.application.NotificationService;
import com.pda.notification.domain.*;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }
    @ModelAttribute
    public void privateResponse(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "private, no-store");
    }
    @PostMapping("/team-deletions/claim")
    @Operation(summary = "Claim one own unread team-deletion popup", description = "CSRF required; at-most-once presentation grant; history/read state retained")
    public ResponseEntity<NotificationResponse> claim(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                     @RequestBody(required = false) java.util.Map<String, Object> body) {
        if (body != null && !body.isEmpty()) throw new IllegalArgumentException("Claim has no request body");
        return service.claimTeamDeletion(actor(principal))
                .map(n -> ResponseEntity.ok().header("Cache-Control", "private, no-store").body(NotificationResponse.from(n)))
                .orElseGet(() -> ResponseEntity.noContent().header("Cache-Control", "private, no-store").build());
    }
    @GetMapping
    @Operation(summary = "List own notifications", description = "Authenticated user; newest first. Optional read=true for history, read=false for unread. Omitted read retains legacy unreadOnly/all behavior; read=true with unreadOnly=true is invalid.")
    public PageResponse list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                             @RequestParam(defaultValue = "false") boolean unreadOnly,
                             @RequestParam(required = false) Boolean read,
                             @RequestParam(required = false) NotificationType type,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid page");
        Page<Notification> result = service.list(actor(principal), unreadOnly, read, type, page, size);
        return new PageResponse(result.getContent().stream().map(NotificationResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @GetMapping("/unread-count")
    @Operation(summary = "Count own unread notifications")
    public CountResponse count(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return new CountResponse(service.unreadCount(actor(principal)));
    }
    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "Mark own notification read", description = "CSRF header required")
    public NotificationResponse read(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                     @PathVariable UUID notificationId) {
        return NotificationResponse.from(service.markRead(actor(principal), notificationId));
    }
    @PatchMapping("/read-all")
    @Operation(summary = "Mark all own notifications read", description = "CSRF header required")
    public CountResponse readAll(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return new CountResponse(service.markAllRead(actor(principal)));
    }
    private static UUID actor(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) throw new AccessDeniedException("Authentication required");
        return principal.id();
    }
    public record PageResponse(List<NotificationResponse> content, int page, int size,
                               long totalElements, int totalPages) {}
    public record CountResponse(long count) {}
    public record NotificationResponse(UUID id, NotificationType type, String title, String message,
                                       boolean read, Instant createdAt, Instant readAt, UUID actorUserId,
                                       UUID projectId, ResourceType resourceType, UUID resourceId,
                                       TaskStatusChange statusChange, TeamDeletion teamDeletion,
                                       RepositoryCommits repositoryCommits, Instant popupPresentedAt) {
        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                    n.isRead(), n.getCreatedAt(), n.getReadAt(), n.getActorUserId(), n.getProjectId(),
                    n.getResourceType(), n.getResourceId(), n.getStatusChange(), n.getTeamDeletion(),
                    n.getRepositoryCommits(), n.getPopupPresentedAt());
        }
    }
}
