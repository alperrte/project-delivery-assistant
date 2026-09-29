package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class Task {
    @Id private UUID id;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "task_number", nullable = false, updatable = false) private long taskNumber;
    @Column(name = "task_key", nullable = false, updatable = false, length = 125) private String taskKey;
    @Column(nullable = false, length = 160) private String title;
    @Column(columnDefinition = "text") private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TaskStatus status;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TaskPriority priority;
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "due_date") private LocalDate dueDate;
    @Column(nullable = false) private boolean blocked;
    @Column(name = "blocked_reason", length = 500) private String blockedReason;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_by") private UUID updatedBy;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "archived_by") private UUID archivedBy;
    @Column(name = "archived_at") private Instant archivedAt;
    @Version private long version;

    protected Task() {}

    public static Task create(UUID projectId, long number, String key, String title, String description,
                              TaskPriority priority, LocalDate startDate, LocalDate dueDate, UUID actor) {
        Task task = new Task();
        task.id = UUID.randomUUID();
        task.projectId = Objects.requireNonNull(projectId);
        task.taskNumber = number;
        task.taskKey = Objects.requireNonNull(key);
        task.status = TaskStatus.BACKLOG;
        task.createdBy = Objects.requireNonNull(actor);
        task.update(title, description, priority == null ? TaskPriority.MEDIUM : priority, startDate, dueDate, actor);
        return task;
    }

    public void update(String title, String description, TaskPriority priority, LocalDate startDate,
                       LocalDate dueDate, UUID actor) {
        requireActive();
        if (title == null || title.isBlank() || title.trim().length() > 160) {
            throw new IllegalArgumentException("Invalid title");
        }
        if (startDate != null && dueDate != null && dueDate.isBefore(startDate)) {
            throw new IllegalArgumentException("dueDate cannot precede startDate");
        }
        this.title = title.trim();
        this.description = description == null || description.isBlank() ? null : description.trim();
        this.priority = Objects.requireNonNull(priority);
        this.startDate = startDate;
        this.dueDate = dueDate;
        touch(actor);
    }

    public boolean changeStatus(TaskStatus next, UUID actor) {
        requireActive();
        Objects.requireNonNull(next);
        if (next == status) return false;
        boolean allowed = switch (status) {
            case BACKLOG -> next == TaskStatus.TODO;
            case TODO -> next == TaskStatus.BACKLOG || next == TaskStatus.IN_PROGRESS;
            case IN_PROGRESS -> next == TaskStatus.TODO || next == TaskStatus.IN_REVIEW;
            case IN_REVIEW -> next == TaskStatus.IN_PROGRESS || next == TaskStatus.TESTING;
            case TESTING -> next == TaskStatus.IN_REVIEW || next == TaskStatus.DONE;
            case DONE -> next == TaskStatus.IN_PROGRESS;
        };
        if (!allowed) throw new TaskConflictException("Invalid task status transition");
        status = next;
        if (next == TaskStatus.DONE) { blocked = false; blockedReason = null; }
        touch(actor);
        return true;
    }

    public boolean setBlocked(boolean value, String reason, UUID actor) {
        requireActive();
        if (value && status == TaskStatus.DONE) throw new TaskConflictException("Done task cannot be blocked");
        String normalized = value && reason != null && !reason.isBlank() ? reason.trim() : null;
        if (normalized != null && normalized.length() > 500) throw new IllegalArgumentException("Blocked reason too long");
        if (blocked == value && Objects.equals(blockedReason, normalized)) return false;
        blocked = value;
        blockedReason = normalized;
        touch(actor);
        return true;
    }

    public void archive(UUID actor) {
        requireActive();
        archivedBy = Objects.requireNonNull(actor);
        archivedAt = Instant.now();
        touch(actor);
    }

    public void requireActive() {
        if (archivedAt != null) throw new TaskConflictException("Task is archived");
    }

    private void touch(UUID actor) { updatedBy = Objects.requireNonNull(actor); updatedAt = Instant.now(); }
    @PrePersist private void beforeInsert() { createdAt = Instant.now(); updatedAt = createdAt; }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public long getTaskNumber() { return taskNumber; }
    public String getTaskKey() { return taskKey; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public TaskStatus getStatus() { return status; }
    public TaskPriority getPriority() { return priority; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getDueDate() { return dueDate; }
    public boolean isBlocked() { return blocked; }
    public String getBlockedReason() { return blockedReason; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getArchivedBy() { return archivedBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public long getVersion() { return version; }
}
