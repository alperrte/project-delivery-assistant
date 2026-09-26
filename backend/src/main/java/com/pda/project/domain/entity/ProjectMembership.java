package com.pda.project.domain.entity;

import com.pda.project.domain.enums.ProjectRole;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "project_memberships",
        uniqueConstraints = @UniqueConstraint(name = "uk_project_memberships_project_user",
                columnNames = {"project_id", "user_id"}),
        indexes = @Index(name = "ix_project_memberships_user", columnList = "user_id, project_id"))
public class ProjectMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "project_membership_roles", joinColumns = @JoinColumn(name = "membership_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 40)
    private Set<ProjectRole> roles = new HashSet<>();

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    protected ProjectMembership() {
    }

    public static ProjectMembership initialManager(UUID projectId, UUID userId) {
        ProjectMembership membership = new ProjectMembership();
        membership.projectId = Objects.requireNonNull(projectId, "projectId is required");
        membership.userId = Objects.requireNonNull(userId, "userId is required");
        membership.roles.add(ProjectRole.PROJECT_MANAGER);
        return membership;
    }

    @PrePersist
    private void beforeInsert() {
        joinedAt = Instant.now();
    }

    public boolean hasRole(ProjectRole role) {
        return roles.contains(role);
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
    public Set<ProjectRole> getRoles() { return Set.copyOf(roles); }
    public Instant getJoinedAt() { return joinedAt; }
}
