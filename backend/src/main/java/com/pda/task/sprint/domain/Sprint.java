package com.pda.task.sprint.domain;

import com.pda.task.domain.TaskConflictException;
import com.pda.task.domain.TaskValidationException;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "sprints")
public class Sprint {
    @Id private UUID id;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(nullable = false, length = 80) private String name;
    @Column(length = 500) private String goal;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "end_date", nullable = false) private LocalDate endDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private SprintStatus status;
    @Column(nullable = false, updatable = false) private int sequence;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_by") private UUID updatedBy;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "completed_by") private UUID completedBy;
    @Column(name = "archived_at") private Instant archivedAt;
    @Version private long version;

    protected Sprint() {}

    public static Sprint create(UUID projectId, int sequence, String name, String goal, LocalDate start,
                                LocalDate end, UUID actor) {
        Sprint sprint = new Sprint();
        sprint.id = UUID.randomUUID();
        sprint.projectId = Objects.requireNonNull(projectId);
        sprint.sequence = sequence;
        sprint.status = SprintStatus.PLANNED;
        sprint.createdBy = Objects.requireNonNull(actor);
        sprint.createdAt = Instant.now();
        sprint.apply(name, goal, start, end, actor);
        return sprint;
    }

    public void update(String name, String goal, LocalDate start, LocalDate end, UUID actor) {
        requireOpen();
        apply(name, goal, start, end, actor);
    }

    private void apply(String name, String goal, LocalDate start, LocalDate end, UUID actor) {
        if (name == null || name.isBlank() || name.trim().length() > 80
                || (goal != null && goal.length() > 500)
                || start == null || end == null || end.isBefore(start)) {
            throw new TaskValidationException("SPRINT_INVALID", "Invalid sprint");
        }
        this.name = name.trim();
        this.goal = goal == null || goal.isBlank() ? null : goal.trim();
        this.startDate = start;
        this.endDate = end;
        this.updatedBy = actor;
        this.updatedAt = Instant.now();
    }

    public void start(UUID actor) {
        requireOpen();
        if (status != SprintStatus.PLANNED) throw new TaskConflictException("SPRINT_NOT_PLANNED", "Sprint already started");
        status = SprintStatus.ACTIVE;
        updatedBy = actor;
        updatedAt = Instant.now();
    }

    public void complete(UUID actor) {
        requireOpen();
        if (status != SprintStatus.ACTIVE) throw new TaskConflictException("SPRINT_NOT_ACTIVE", "Sprint is not active");
        status = SprintStatus.COMPLETED;
        completedAt = Instant.now();
        completedBy = actor;
        updatedBy = actor;
        updatedAt = completedAt;
    }

    public void archive(UUID actor) {
        requireOpen();
        if (status != SprintStatus.PLANNED) throw new TaskConflictException("SPRINT_COMPLETED", "Only planned sprints can be archived");
        archivedAt = Instant.now();
        updatedBy = actor;
        updatedAt = archivedAt;
    }

    private void requireOpen() {
        if (archivedAt != null) throw new TaskConflictException("SPRINT_ARCHIVED", "Sprint is archived");
        if (status == SprintStatus.COMPLETED) throw new TaskConflictException("SPRINT_COMPLETED", "Sprint is completed");
    }

    public boolean acceptsTasks() { return archivedAt == null && status != SprintStatus.COMPLETED; }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getName() { return name; }
    public String getGoal() { return goal; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public SprintStatus getStatus() { return status; }
    public int getSequence() { return sequence; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public long getVersion() { return version; }
}
