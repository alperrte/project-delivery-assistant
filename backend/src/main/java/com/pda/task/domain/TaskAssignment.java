package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_assignments")
public class TaskAssignment {
    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(name = "user_id", nullable = false, updatable = false) private UUID userId;
    @Column(name = "assigned_by", nullable = false, updatable = false) private UUID assignedBy;
    @Column(name = "assigned_at", nullable = false, updatable = false) private Instant assignedAt;
    protected TaskAssignment() {}
    public TaskAssignment(UUID taskId, UUID userId, UUID assignedBy) {
        this.id = UUID.randomUUID(); this.taskId = taskId; this.userId = userId;
        this.assignedBy = assignedBy; this.assignedAt = Instant.now();
    }
    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getUserId() { return userId; }
    public UUID getAssignedBy() { return assignedBy; }
    public Instant getAssignedAt() { return assignedAt; }
}
