package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_activities")
public class TaskActivity {
    private static final int MAX_VALUE = 500;

    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "actor_id", updatable = false) private UUID actorId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 40) private ActivityType type;
    @Column(updatable = false, length = 40) private String field;
    @Column(name = "old_value", updatable = false, length = MAX_VALUE) private String oldValue;
    @Column(name = "new_value", updatable = false, length = MAX_VALUE) private String newValue;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TaskActivity() {}

    public TaskActivity(UUID taskId, UUID projectId, UUID actorId, ActivityType type, String field,
                        String oldValue, String newValue) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.projectId = projectId;
        this.actorId = actorId;
        this.type = type;
        this.field = field;
        this.oldValue = clip(oldValue);
        this.newValue = clip(newValue);
        this.createdAt = Instant.now();
    }

    private static String clip(String value) {
        return value == null || value.length() <= MAX_VALUE ? value : value.substring(0, MAX_VALUE);
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getProjectId() { return projectId; }
    public UUID getActorId() { return actorId; }
    public ActivityType getType() { return type; }
    public String getField() { return field; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public Instant getCreatedAt() { return createdAt; }
}
