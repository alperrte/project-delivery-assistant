package com.pda.project.domain.entity;

import com.pda.user.ProjectRole;
import com.pda.project.domain.enums.MembershipStatus;
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
import org.hibernate.annotations.BatchSize;

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
    @BatchSize(size = 100)
    @CollectionTable(name = "project_membership_roles", joinColumns = @JoinColumn(name = "membership_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 40)
    private Set<ProjectRole> roles = new HashSet<>();

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MembershipStatus status;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected ProjectMembership() {
    }

    public static ProjectMembership initialManager(UUID projectId, UUID userId) {
        return active(projectId, userId, Set.of(ProjectRole.PROJECT_MANAGER));
    }

    public static ProjectMembership active(UUID projectId, UUID userId, Set<ProjectRole> roles) {
        ProjectMembership membership = new ProjectMembership();
        membership.projectId = Objects.requireNonNull(projectId, "projectId is required");
        membership.userId = Objects.requireNonNull(userId, "userId is required");
        membership.roles.addAll(requireRoles(roles));
        membership.status = MembershipStatus.ACTIVE;
        return membership;
    }

    @PrePersist
    private void beforeInsert() {
        joinedAt = Instant.now();
    }

    public boolean hasRole(ProjectRole role) {
        return status == MembershipStatus.ACTIVE && roles.contains(role);
    }

    public void addRole(ProjectRole role) {
        requireActive();
        roles.add(Objects.requireNonNull(role, "role is required"));
    }

    public void replaceRoles(Set<ProjectRole> roles) {
        requireActive();
        Set<ProjectRole> checked = Set.copyOf(requireRoles(roles));
        this.roles.clear();
        this.roles.addAll(checked);
    }

    public void removeRole(ProjectRole role) {
        requireActive();
        if (!roles.contains(Objects.requireNonNull(role, "role is required"))) {
            throw new IllegalArgumentException("role is not assigned");
        }
        if (roles.size() == 1) {
            throw new IllegalArgumentException("membership must retain a role");
        }
        roles.remove(role);
    }

    public void remove() {
        requireActive();
        status = MembershipStatus.REMOVED;
        removedAt = Instant.now();
        roles.clear();
    }

    public void reactivate(Set<ProjectRole> roles) {
        if (status != MembershipStatus.REMOVED) {
            throw new IllegalStateException("membership is already active");
        }
        this.roles.addAll(requireRoles(roles));
        status = MembershipStatus.ACTIVE;
        joinedAt = Instant.now();
        removedAt = null;
    }

    private void requireActive() {
        if (status != MembershipStatus.ACTIVE) {
            throw new IllegalStateException("membership is removed");
        }
    }

    private static Set<ProjectRole> requireRoles(Set<ProjectRole> roles) {
        Objects.requireNonNull(roles, "roles are required");
        if (roles.isEmpty() || roles.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("at least one valid role is required");
        }
        return roles;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
    public Set<ProjectRole> getRoles() { return Set.copyOf(roles); }
    public Instant getJoinedAt() { return joinedAt; }
    public MembershipStatus getStatus() { return status; }
    public Instant getRemovedAt() { return removedAt; }
}
