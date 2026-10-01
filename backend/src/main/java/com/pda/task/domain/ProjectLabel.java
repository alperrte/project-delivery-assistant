package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "project_labels")
public class ProjectLabel {
    public static final Set<String> COLORS =
            Set.of("slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink");

    @Id private UUID id;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(nullable = false, length = 40) private String name;
    @Column(nullable = false, length = 16) private String color;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "archived_at") private Instant archivedAt;

    protected ProjectLabel() {}

    public ProjectLabel(UUID projectId, String name, String color, UUID actor) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.createdBy = actor;
        this.createdAt = Instant.now();
        change(name, color);
    }

    public void change(String name, String color) {
        if (name == null || name.isBlank() || name.trim().length() > 40) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid label name");
        }
        if (color == null || !COLORS.contains(color)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid label color");
        }
        this.name = name.trim();
        this.color = color;
    }

    public void archive() { if (archivedAt == null) archivedAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getName() { return name; }
    public String getColor() { return color; }
    public Instant getArchivedAt() { return archivedAt; }
}
