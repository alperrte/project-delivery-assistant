package com.pda.notification.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {
    @Id private UUID id;
    @Column(name = "recipient_user_id", nullable = false, updatable = false) private UUID recipientUserId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40) private NotificationType type;
    @Column(nullable = false, length = 160) private String title;
    @Column(nullable = false, length = 500) private String message;
    @Column(name = "is_read", nullable = false) private boolean read;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "read_at") private Instant readAt;
    @Column(name = "actor_user_id") private UUID actorUserId;
    @Column(name = "project_id") private UUID projectId;
    @Enumerated(EnumType.STRING) @Column(name = "resource_type", nullable = false, length = 20)
    private ResourceType resourceType;
    @Column(name = "resource_id", nullable = false) private UUID resourceId;
    @Column(name = "task_status_previous", length = 20) private String taskStatusPrevious;
    @Column(name = "task_status_current", length = 20) private String taskStatusCurrent;
    @Column(name = "task_key", length = 125) private String taskKey;
    @Column(name = "task_title", length = 160) private String taskTitle;
    @Column(name = "actor_nickname", length = 32) private String actorNickname;

    protected Notification() {}
    public Notification(UUID recipientUserId, NotificationType type, String title, String message,
                        UUID actorUserId, UUID projectId, ResourceType resourceType, UUID resourceId) {
        this(recipientUserId, type, title, message, actorUserId, projectId, resourceType, resourceId, null);
    }
    public Notification(UUID recipientUserId, NotificationType type, String title, String message,
                        UUID actorUserId, UUID projectId, ResourceType resourceType, UUID resourceId,
                        TaskStatusChange statusChange) {
        this.id = UUID.randomUUID(); this.recipientUserId = recipientUserId;
        this.type = type; this.title = title; this.message = message;
        this.actorUserId = actorUserId; this.projectId = projectId;
        this.resourceType = resourceType; this.resourceId = resourceId;
        this.createdAt = Instant.now();
        if (statusChange != null) {
            this.taskStatusPrevious = statusChange.previousStatus();
            this.taskStatusCurrent = statusChange.newStatus();
            this.taskKey = statusChange.taskKey();
            this.taskTitle = statusChange.taskTitle();
            this.actorNickname = statusChange.actorNickname();
        }
    }
    public void markRead() { if (!read) { read = true; readAt = Instant.now(); } }
    public UUID getId() { return id; }
    public UUID getRecipientUserId() { return recipientUserId; }
    public NotificationType getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public boolean isRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public UUID getActorUserId() { return actorUserId; }
    public UUID getProjectId() { return projectId; }
    public ResourceType getResourceType() { return resourceType; }
    public UUID getResourceId() { return resourceId; }
    public TaskStatusChange getStatusChange() {
        return taskStatusCurrent == null ? null : new TaskStatusChange(taskStatusPrevious, taskStatusCurrent,
                taskKey, taskTitle, actorNickname);
    }
}
