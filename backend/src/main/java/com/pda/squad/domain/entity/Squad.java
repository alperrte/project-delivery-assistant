package com.pda.squad.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A project-scoped team grouping (HMZ-PROJ-17). A squad belongs to exactly one project and never grants
 * authorization by itself: what a member may do in the project is decided solely by their {@code ProjectMembership}
 * roles (see {@code com.pda.user.RolePolicy}), not by squad membership.
 */
@Entity
@Table(name = "squads", indexes = @Index(name = "ix_squads_project_active", columnList = "project_id, archived_at"))
public class Squad {

    private static final int NAME_LIMIT = 120;
    private static final int DESCRIPTION_LIMIT = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(nullable = false, length = NAME_LIMIT)
    private String name;

    @Column(length = DESCRIPTION_LIMIT)
    private String description;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "parent_squad_id")
    private UUID parentSquadId;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    protected Squad() {
        // JPA
    }

    public static Squad create(UUID projectId, String name, String description, UUID createdBy) {
        Squad squad = new Squad();
        squad.projectId = Objects.requireNonNull(projectId, "projectId is required");
        squad.name = requiredText(name, NAME_LIMIT, "name");
        squad.description = optionalText(description, DESCRIPTION_LIMIT, "description");
        squad.createdBy = Objects.requireNonNull(createdBy, "createdBy is required");
        squad.updatedBy = createdBy;
        return squad;
    }

    /** A {@code null} parent makes the team a top-level team. */
    public void moveUnder(UUID parentId, UUID actor) {
        requireActive();
        if (id != null && id.equals(parentId)) throw new IllegalArgumentException("Team cannot parent itself");
        parentSquadId = parentId;
        touch(actor);
    }

    public void updateDetails(String name, String description, UUID actor) {
        requireActive();
        this.name = requiredText(name, NAME_LIMIT, "name");
        this.description = optionalText(description, DESCRIPTION_LIMIT, "description");
        touch(actor);
    }

    /** Records who last changed the team; the timestamp follows through {@code @PreUpdate}. */
    public void touch(UUID actor) {
        this.updatedBy = Objects.requireNonNull(actor, "actor is required");
        this.updatedAt = Instant.now();
    }

    public void archive(UUID actor) {
        if (archivedAt == null) {
            archivedAt = Instant.now();
            touch(actor);
        }
    }

    public boolean isActive() {
        return archivedAt == null;
    }

    public void requireActive() {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived squads cannot be changed");
        }
    }

    @PrePersist
    private void beforeInsert() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    private void beforeUpdate() {
        updatedAt = Instant.now();
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
    public UUID getParentSquadId() { return parentSquadId; }
    public UUID getUpdatedBy() { return updatedBy; }
    public UUID getProjectId() { return projectId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
