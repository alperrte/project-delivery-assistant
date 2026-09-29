package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_status_history")
public class TaskStatusHistory {
    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Enumerated(EnumType.STRING) @Column(name = "previous_status", nullable = false, updatable = false)
    private TaskStatus previousStatus;
    @Enumerated(EnumType.STRING) @Column(name = "new_status", nullable = false, updatable = false)
    private TaskStatus newStatus;
    @Column(name = "changed_by", nullable = false, updatable = false) private UUID changedBy;
    @Column(name = "changed_at", nullable = false, updatable = false) private Instant changedAt;
    protected TaskStatusHistory() {}
    public TaskStatusHistory(UUID taskId, TaskStatus previousStatus, TaskStatus newStatus, UUID changedBy) {
        id = UUID.randomUUID(); this.taskId = taskId; this.previousStatus = previousStatus;
        this.newStatus = newStatus; this.changedBy = changedBy; changedAt = Instant.now();
    }
    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public TaskStatus getPreviousStatus() { return previousStatus; }
    public TaskStatus getNewStatus() { return newStatus; }
    public UUID getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }
}
