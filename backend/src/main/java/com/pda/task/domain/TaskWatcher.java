package com.pda.task.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "task_watchers")
@IdClass(TaskWatcher.Key.class)
public class TaskWatcher {
    @Id @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Id @Column(name = "user_id", nullable = false, updatable = false) private UUID userId;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    @Column(name = "manual_watch", nullable = false) private boolean manualWatch;
    public boolean isManualWatch() { return manualWatch; }

    protected TaskWatcher() {}

    public TaskWatcher(UUID taskId, UUID userId) {
        this.taskId = taskId;
        this.userId = userId;
        this.createdAt = Instant.now();
    }

    public UUID getTaskId() { return taskId; }
    public UUID getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }

    public record Key(UUID taskId, UUID userId) implements Serializable {
        public Key { Objects.requireNonNull(taskId); Objects.requireNonNull(userId); }
    }
}
