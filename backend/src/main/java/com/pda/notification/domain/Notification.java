package com.pda.notification.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@org.hibernate.annotations.DynamicUpdate
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
    @Column(name = "source_event_id", updatable = false) private UUID sourceEventId;
    @Column(name = "team_deleted_project_name", length = 160) private String teamDeletedProjectName;
    @Column(name = "team_deleted_team_name", length = 120) private String teamDeletedTeamName;
    @Column(name = "team_deleted_actor_nickname", length = 32) private String teamDeletedActorNickname;
    @Column(name = "team_deleted_at") private Instant teamDeletedAt;
    @Column(name = "popup_presented_at") private Instant popupPresentedAt;

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
    public static Notification teamDeleted(UUID recipient, UUID actor, UUID project, UUID team,
                                           UUID eventId, TeamDeletion deletion) {
        java.util.Objects.requireNonNull(deletion, "deletion");
        var notification = new Notification(recipient, NotificationType.SQUAD_DELETED, "Team deleted",
                "The team \"" + deletion.teamName() + "\" in project \"" + deletion.projectName()
                        + "\" was deleted by " + (deletion.actorNickname() == null ? "a project manager" : deletion.actorNickname()) + ".",
                java.util.Objects.requireNonNull(actor, "actor"), java.util.Objects.requireNonNull(project, "project"),
                ResourceType.SQUAD, java.util.Objects.requireNonNull(team, "team"));
        notification.sourceEventId = java.util.Objects.requireNonNull(eventId, "eventId");
        notification.teamDeletedProjectName = deletion.projectName();
        notification.teamDeletedTeamName = deletion.teamName();
        notification.teamDeletedActorNickname = deletion.actorNickname();
        notification.teamDeletedAt = deletion.occurredAt();
        return notification;
    }

    public TeamDeletion getTeamDeletion() {
        return teamDeletedAt == null ? null : new TeamDeletion(teamDeletedProjectName, teamDeletedTeamName,
                teamDeletedActorNickname, teamDeletedAt);
    }
    public UUID getSourceEventId() { return sourceEventId; }
    public Instant getPopupPresentedAt() { return popupPresentedAt; }
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
