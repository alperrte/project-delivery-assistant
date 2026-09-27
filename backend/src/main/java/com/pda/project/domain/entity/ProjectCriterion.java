package com.pda.project.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A project-level success/closure checklist item (HMZ-PROJ-22). Deliberately not a task: it carries no assignee,
 * status workflow or Work Service link, and is never used to compute project progress by itself.
 */
@Entity
@Table(name = "project_criteria",
        indexes = @Index(name = "ix_project_criteria_project_sort", columnList = "project_id, sort_order"))
public class ProjectCriterion {

    private static final int TITLE_LIMIT = 200;
    private static final int DESCRIPTION_LIMIT = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(nullable = false, length = TITLE_LIMIT)
    private String title;

    @Column(length = DESCRIPTION_LIMIT)
    private String description;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_by")
    private UUID completedBy;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected ProjectCriterion() {
        // JPA
    }

    public static ProjectCriterion create(UUID projectId, String title, String description, int sortOrder,
                                          UUID createdBy) {
        ProjectCriterion criterion = new ProjectCriterion();
        criterion.projectId = Objects.requireNonNull(projectId, "projectId is required");
        criterion.title = requiredText(title, TITLE_LIMIT, "title");
        criterion.description = optionalText(description, DESCRIPTION_LIMIT, "description");
        criterion.sortOrder = sortOrder;
        criterion.createdBy = Objects.requireNonNull(createdBy, "createdBy is required");
        criterion.completed = false;
        return criterion;
    }

    public void updateDetails(String title, String description) {
        this.title = requiredText(title, TITLE_LIMIT, "title");
        this.description = optionalText(description, DESCRIPTION_LIMIT, "description");
    }

    public void updateSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public void complete(UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        if (completed) {
            throw new IllegalStateException("Criterion is already completed");
        }
        completed = true;
        completedBy = userId;
        completedAt = Instant.now();
    }

    public void uncomplete() {
        if (!completed) {
            throw new IllegalStateException("Criterion is not completed");
        }
        completed = false;
        completedBy = null;
        completedAt = null;
    }

    @PrePersist
    private void beforeInsert() {
        createdAt = Instant.now();
    }

    private static String requiredText(String value, int maxLength, String field) {
        String normalized = optionalText(value, maxLength, field);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private static String optionalText(String value, int maxLength, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public boolean isCompleted() { return completed; }
    public int getSortOrder() { return sortOrder; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCompletedBy() { return completedBy; }
    public Instant getCompletedAt() { return completedAt; }
}
