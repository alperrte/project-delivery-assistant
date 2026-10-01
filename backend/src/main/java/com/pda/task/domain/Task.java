package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class Task {
    /** The zone in which a deadline's calendar day is judged against the start date. */
    public static final ZoneId DEADLINE_ZONE = ZoneId.of("Europe/Istanbul");
    private static final Set<Integer> ESTIMATE_POINTS = Set.of(0, 1, 2, 3, 5, 8, 13, 21);

    @Id private UUID id;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "task_number", nullable = false, updatable = false) private long taskNumber;
    @Column(name = "task_key", nullable = false, updatable = false, length = 125) private String taskKey;
    @Column(nullable = false, length = 160) private String title;
    @Column(columnDefinition = "text") private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TaskStatus status;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TaskPriority priority;
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "deadline_at") private Instant deadlineAt;
    @Column(name = "deadline_reminded_at") private Instant deadlineRemindedAt;
    @Column(name = "deadline_overdue_notified_at") private Instant deadlineOverdueNotifiedAt;
    @Column(nullable = false) private boolean blocked;
    @Column(name = "blocked_reason", length = 500) private String blockedReason;
    @Column(name = "pool_open", nullable = false) private boolean poolOpen;
    @Column(name = "pool_team_id") private UUID poolTeamId;
    @Column(name = "claimed_from_pool", nullable = false) private boolean claimedFromPool;
    @Column(name = "parent_task_id") private UUID parentTaskId;
    @Column(name = "sprint_id") private UUID sprintId;
    @Column(name = "estimate_points") private Short estimatePoints;
    @Column(name = "time_estimate_minutes") private Integer timeEstimateMinutes;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_by") private UUID updatedBy;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "archived_by") private UUID archivedBy;
    @Column(name = "archived_at") private Instant archivedAt;
    @Version private long version;

    protected Task() {}

    public static Task create(UUID projectId, long number, String key, TaskDraft draft, UUID actor) {
        Task task = new Task();
        task.id = UUID.randomUUID();
        task.projectId = Objects.requireNonNull(projectId);
        task.taskNumber = number;
        task.taskKey = Objects.requireNonNull(key);
        task.status = TaskStatus.BACKLOG;
        task.createdBy = Objects.requireNonNull(actor);
        task.update(draft, actor);
        return task;
    }

    public void update(TaskDraft draft, UUID actor) {
        requireActive();
        String name = draft.title();
        if (name == null || name.isBlank() || name.trim().length() > 160) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid title");
        }
        String text = draft.description();
        if (text != null && text.length() > 10000) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Description too long");
        }
        Instant deadline = draft.deadlineAt();
        if (draft.startDate() != null && deadline != null
                && deadline.atZone(DEADLINE_ZONE).toLocalDate().isBefore(draft.startDate())) {
            throw new TaskValidationException("TASK_DATES_INVALID", "Deadline cannot precede the start date");
        }
        Integer points = draft.estimatePoints();
        if (points != null && !ESTIMATE_POINTS.contains(points)) {
            throw new TaskValidationException("TASK_INVALID_ESTIMATE", "Invalid estimate points");
        }
        Integer minutes = draft.timeEstimateMinutes();
        if (minutes != null && (minutes < 1 || minutes > 100000)) {
            throw new TaskValidationException("TASK_INVALID_ESTIMATE", "Invalid time estimate");
        }
        this.title = name.trim();
        this.description = text == null || text.isBlank() ? null : text.trim();
        this.priority = Objects.requireNonNull(draft.priority() == null ? TaskPriority.MEDIUM : draft.priority());
        this.startDate = draft.startDate();
        if (!Objects.equals(this.deadlineAt, deadline)) {
            // A moved deadline starts a fresh reminder cycle.
            this.deadlineRemindedAt = null;
            this.deadlineOverdueNotifiedAt = null;
        }
        this.deadlineAt = deadline;
        this.estimatePoints = points == null ? null : points.shortValue();
        this.timeEstimateMinutes = minutes;
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
        if (!allowed) throw new TaskConflictException("TASK_INVALID_TRANSITION", "Invalid task status transition");
        status = next;
        if (next == TaskStatus.DONE) {
            blocked = false;
            blockedReason = null;
            poolOpen = false;
        }
        touch(actor);
        return true;
    }

    public boolean setBlocked(boolean value, String reason, UUID actor) {
        requireActive();
        if (value && status == TaskStatus.DONE) {
            throw new TaskConflictException("TASK_DONE_CANNOT_BLOCK", "Done task cannot be blocked");
        }
        String normalized = value && reason != null && !reason.isBlank() ? reason.trim() : null;
        if (normalized != null && normalized.length() > 500) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Blocked reason too long");
        }
        if (blocked == value && Objects.equals(blockedReason, normalized)) return false;
        blocked = value;
        blockedReason = normalized;
        touch(actor);
        return true;
    }

    /** Offers the task to the pool (optionally only to one team). The caller guarantees nobody is assigned. */
    public void openPool(UUID teamId, UUID actor) {
        requireActive();
        if (status == TaskStatus.DONE) {
            throw new TaskConflictException("TASK_DONE_CANNOT_POOL", "Done task cannot be offered to the pool");
        }
        poolOpen = true;
        poolTeamId = teamId;
        claimedFromPool = false;
        touch(actor);
    }

    public void closePool(UUID actor) {
        requireActive();
        poolOpen = false;
        poolTeamId = null;
        claimedFromPool = false;
        touch(actor);
    }

    /** The caller has just been assigned; the task leaves the pool but keeps its team target for a release. */
    public void claimed(UUID actor) {
        requireActive();
        poolOpen = false;
        claimedFromPool = true;
        touch(actor);
    }

    public void returnedToPool(UUID actor) {
        requireActive();
        poolOpen = true;
        claimedFromPool = false;
        touch(actor);
    }

    /** A manager assigned people directly: the task is no longer an open pool offer or a pool claim. */
    public void assignedDirectly(UUID actor) {
        requireActive();
        if (!poolOpen && !claimedFromPool) return;
        poolOpen = false;
        claimedFromPool = false;
        touch(actor);
    }

    public void setParent(UUID parentTaskId, UUID actor) {
        requireActive();
        this.parentTaskId = parentTaskId;
        touch(actor);
    }

    public void setSprint(UUID sprintId, UUID actor) {
        requireActive();
        this.sprintId = sprintId;
        touch(actor);
    }

    public void touchedBy(UUID actor) { touch(actor); }

    public void archive(UUID actor) {
        requireActive();
        archivedBy = Objects.requireNonNull(actor);
        archivedAt = Instant.now();
        poolOpen = false;
        touch(actor);
    }

    public void requireActive() {
        if (archivedAt != null) throw new TaskConflictException("TASK_ARCHIVED", "Task is archived");
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
    public Instant getDeadlineAt() { return deadlineAt; }
    public Instant getDeadlineRemindedAt() { return deadlineRemindedAt; }
    public Instant getDeadlineOverdueNotifiedAt() { return deadlineOverdueNotifiedAt; }
    public boolean isBlocked() { return blocked; }
    public String getBlockedReason() { return blockedReason; }
    public boolean isPoolOpen() { return poolOpen; }
    public UUID getPoolTeamId() { return poolTeamId; }
    public boolean isClaimedFromPool() { return claimedFromPool; }
    public UUID getParentTaskId() { return parentTaskId; }
    public UUID getSprintId() { return sprintId; }
    public Integer getEstimatePoints() { return estimatePoints == null ? null : estimatePoints.intValue(); }
    public Integer getTimeEstimateMinutes() { return timeEstimateMinutes; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getArchivedBy() { return archivedBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public long getVersion() { return version; }
}
