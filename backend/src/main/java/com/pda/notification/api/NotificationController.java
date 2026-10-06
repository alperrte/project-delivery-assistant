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

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }
    @GetMapping
    @Operation(summary = "List own notifications", description = "Authenticated user; newest first")
    public PageResponse list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                             @RequestParam(defaultValue = "false") boolean unreadOnly,
                             @RequestParam(required = false) NotificationType type,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid page");
        Page<Notification> result = service.list(actor(principal), unreadOnly, type, page, size);
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
                                       TaskStatusChange statusChange) {
        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                    n.isRead(), n.getCreatedAt(), n.getReadAt(), n.getActorUserId(), n.getProjectId(),
                    n.getResourceType(), n.getResourceId(), n.getStatusChange());
        }
    }
}
