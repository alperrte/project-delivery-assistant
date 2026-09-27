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
 * Links a user (identified only by id; Squad never depends on the User module's entity/repository) to a squad.
 * Carries no role: squad membership is a grouping only, never an authorization source.
 */
@Entity
@Table(name = "squad_members",
        uniqueConstraints = @UniqueConstraint(name = "uk_squad_members_squad_user", columnNames = {"squad_id", "user_id"}),
        indexes = @Index(name = "ix_squad_members_user", columnList = "user_id"))
public class SquadMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "squad_id", nullable = false, updatable = false)
    private UUID squadId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "added_by", nullable = false, updatable = false)
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    protected SquadMembership() {
        // JPA
    }

    public static SquadMembership add(UUID squadId, UUID userId, UUID addedBy) {
        SquadMembership membership = new SquadMembership();
        membership.squadId = Objects.requireNonNull(squadId, "squadId is required");
        membership.userId = Objects.requireNonNull(userId, "userId is required");
        membership.addedBy = Objects.requireNonNull(addedBy, "addedBy is required");
        return membership;
    }

    @PrePersist
    private void beforeInsert() {
        addedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getSquadId() { return squadId; }
    public UUID getUserId() { return userId; }
    public UUID getAddedBy() { return addedBy; }
    public Instant getAddedAt() { return addedAt; }
}
