package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_comments")
public class TaskComment {
    public static final int MAX_BODY = 10000;

    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "author_id", nullable = false, updatable = false) private UUID authorId;
    @Column(nullable = false, columnDefinition = "text") private String body;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "edited_at") private Instant editedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "deleted_by") private UUID deletedBy;

    protected TaskComment() {}

    public TaskComment(UUID taskId, UUID projectId, UUID authorId, String body) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.projectId = projectId;
        this.authorId = authorId;
        this.body = normalize(body);
        this.createdAt = Instant.now();
    }

    private static String normalize(String body) {
        if (body == null || body.isBlank() || body.length() > MAX_BODY) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid comment");
        }
        return body.trim();
    }

    public void edit(String body) {
        if (deletedAt != null) throw new TaskConflictException("TASK_COMMENT_DELETED", "Comment was deleted");
        this.body = normalize(body);
        this.editedAt = Instant.now();
    }

    public void delete(UUID actor) {
        if (deletedAt != null) return;
        deletedAt = Instant.now();
        deletedBy = actor;
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getProjectId() { return projectId; }
    public UUID getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getEditedAt() { return editedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public boolean isDeleted() { return deletedAt != null; }
}
