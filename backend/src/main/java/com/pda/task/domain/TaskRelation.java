package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_relations")
public class TaskRelation {
    @Id private UUID id;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "source_task_id", nullable = false, updatable = false) private UUID sourceTaskId;
    @Column(name = "target_task_id", nullable = false, updatable = false) private UUID targetTaskId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16) private RelationType type;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TaskRelation() {}

    public TaskRelation(UUID projectId, UUID sourceTaskId, UUID targetTaskId, RelationType type, UUID actor) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.sourceTaskId = sourceTaskId;
        this.targetTaskId = targetTaskId;
        this.type = type;
        this.createdBy = actor;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getSourceTaskId() { return sourceTaskId; }
    public UUID getTargetTaskId() { return targetTaskId; }
    public RelationType getType() { return type; }
    public Instant getCreatedAt() { return createdAt; }
}
