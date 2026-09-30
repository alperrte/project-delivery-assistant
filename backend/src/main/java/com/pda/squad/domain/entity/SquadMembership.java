package com.pda.squad.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Links an authoritative ProjectMembership ID to a team; no user/profile data is duplicated here.
 * Carries no role: squad membership is a grouping only, never an authorization source.
 */
@Entity
@Table(name = "squad_members",
        uniqueConstraints = @UniqueConstraint(name = "uk_squad_members_squad_membership",
                columnNames = {"squad_id", "project_membership_id"}),
        indexes = @Index(name = "ix_squad_members_membership", columnList = "project_membership_id"))
public class SquadMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "squad_id", nullable = false, updatable = false)
    private UUID squadId;

    @Column(name = "project_membership_id", nullable = false, updatable = false)
    private UUID projectMembershipId;

    @Column(name = "added_by", nullable = false, updatable = false)
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    protected SquadMembership() {
        // JPA
    }

    public static SquadMembership add(UUID squadId, UUID projectMembershipId, UUID addedBy) {
        SquadMembership membership = new SquadMembership();
        membership.squadId = Objects.requireNonNull(squadId, "squadId is required");
        membership.projectMembershipId = Objects.requireNonNull(projectMembershipId, "projectMembershipId is required");
        membership.addedBy = Objects.requireNonNull(addedBy, "addedBy is required");
        return membership;
    }

    @PrePersist
    private void beforeInsert() {
        addedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getSquadId() { return squadId; }
    public UUID getProjectMembershipId() { return projectMembershipId; }
    public UUID getAddedBy() { return addedBy; }
    public Instant getAddedAt() { return addedAt; }
}
