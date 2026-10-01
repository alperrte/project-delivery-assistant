package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "task_worklogs")
public class TaskWorklog {
    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "user_id", nullable = false, updatable = false) private UUID userId;
    @Column(nullable = false) private int minutes;
    @Column(name = "work_date", nullable = false) private LocalDate workDate;
    @Column(length = 500) private String note;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;

    protected TaskWorklog() {}

    public TaskWorklog(UUID taskId, UUID projectId, UUID userId, int minutes, LocalDate workDate, String note,
                       LocalDate today) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.projectId = projectId;
        this.userId = userId;
        this.createdAt = Instant.now();
        change(minutes, workDate, note, today);
    }

    public void change(int minutes, LocalDate workDate, String note, LocalDate today) {
        // today is the UTC date; one day of slack keeps a viewer ahead of UTC from logging "today" as the future
        if (minutes < 1 || minutes > 1440 || workDate == null || workDate.isAfter(today.plusDays(1))
                || (note != null && note.length() > 500)) {
            throw new TaskValidationException("WORKLOG_INVALID", "Invalid worklog");
        }
        this.minutes = minutes;
        this.workDate = workDate;
        this.note = note == null || note.isBlank() ? null : note.trim();
        this.updatedAt = Instant.now();
    }

    public void delete() {
        if (deletedAt == null) {
            deletedAt = Instant.now();
            updatedAt = deletedAt;
        }
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
    public int getMinutes() { return minutes; }
    public LocalDate getWorkDate() { return workDate; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
