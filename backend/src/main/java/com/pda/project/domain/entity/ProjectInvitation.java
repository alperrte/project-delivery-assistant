package com.pda.project.domain.entity;

import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * A pending, accepted, rejected, cancelled or expired invitation of a user (registered, by id, or unregistered, by
 * email) into a project with an initial role set. The raw invitation token is never persisted; only its SHA-256
 * hash is stored, mirroring {@link com.pda.user.domain.entity.UserSession}'s refresh-token handling.
 */
@Entity
@Table(name = "project_invitations",
        uniqueConstraints = @UniqueConstraint(name = "uk_project_invitations_token_hash", columnNames = "token_hash"),
        indexes = @Index(name = "ix_project_invitations_project_status", columnList = "project_id, status"))
public class ProjectInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "invited_user_id", updatable = false)
    private UUID invitedUserId;

    @Column(name = "email", length = 320, updatable = false)
    private String email;

    @Column(name = "invited_by", nullable = false, updatable = false)
    private UUID invitedBy;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "project_invitation_roles", joinColumns = @JoinColumn(name = "invitation_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 40)
    private Set<ProjectRole> initialRoles = new HashSet<>();

    @Column(name = "token_hash", nullable = false, length = 64, updatable = false)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InvitationStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected ProjectInvitation() {
        // JPA
    }

    /** Invitation for a user who already has a PDA account, targeted by id (never by exposing their email). */
    public static ProjectInvitation forRegisteredUser(UUID projectId, UUID invitedUserId, UUID invitedBy,
                                                      Set<ProjectRole> initialRoles, String rawToken,
                                                      Instant expiresAt) {
        return create(projectId, Objects.requireNonNull(invitedUserId, "invitedUserId is required"), null,
                invitedBy, initialRoles, rawToken, expiresAt);
    }

    /** Invitation for someone without a PDA account yet, targeted by email. */
    public static ProjectInvitation forEmail(UUID projectId, String email, UUID invitedBy,
                                             Set<ProjectRole> initialRoles, String rawToken, Instant expiresAt) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email is required");
        }
        return create(projectId, null, email.strip(), invitedBy, initialRoles, rawToken, expiresAt);
    }

    private static ProjectInvitation create(UUID projectId, UUID invitedUserId, String email, UUID invitedBy,
                                            Set<ProjectRole> initialRoles, String rawToken, Instant expiresAt) {
        Objects.requireNonNull(projectId, "projectId is required");
        Objects.requireNonNull(invitedBy, "invitedBy is required");
        Objects.requireNonNull(expiresAt, "expiresAt is required");
        if (initialRoles == null || initialRoles.isEmpty() || initialRoles.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("at least one valid role is required");
        }
        ProjectInvitation invitation = new ProjectInvitation();
        invitation.projectId = projectId;
        invitation.invitedUserId = invitedUserId;
        invitation.email = email;
        invitation.invitedBy = invitedBy;
        invitation.initialRoles.addAll(initialRoles);
        invitation.tokenHash = hashToken(rawToken);
        invitation.status = InvitationStatus.PENDING;
        invitation.expiresAt = expiresAt;
        return invitation;
    }

    public boolean matchesToken(String rawToken) {
        return rawToken != null && MessageDigest.isEqual(
                tokenHash.getBytes(StandardCharsets.US_ASCII),
                hashToken(rawToken).getBytes(StandardCharsets.US_ASCII));
    }

    public boolean isPending(Instant now) {
        return status == InvitationStatus.PENDING && expiresAt.isAfter(now);
    }

    public void accept(Instant now) {
        requirePending(now);
        status = InvitationStatus.ACCEPTED;
        acceptedAt = now;
    }

    public void reject(Instant now) {
        requirePending(now);
        status = InvitationStatus.REJECTED;
        rejectedAt = now;
    }

    public void cancel(Instant now) {
        requirePending(now);
        status = InvitationStatus.CANCELLED;
        cancelledAt = now;
    }

    /** Idempotent: flips a timed-out PENDING invitation to EXPIRED; a no-op for any other state. */
    public void expire(Instant now) {
        if (status == InvitationStatus.PENDING && !expiresAt.isAfter(now)) {
            status = InvitationStatus.EXPIRED;
        }
    }

    private void requirePending(Instant now) {
        if (!isPending(now)) {
            throw new IllegalStateException("Invitation is not pending");
        }
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public static String hashToken(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token is required");
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getInvitedUserId() { return invitedUserId; }
    public String getEmail() { return email; }
    public UUID getInvitedBy() { return invitedBy; }
    public Set<ProjectRole> getInitialRoles() { return Set.copyOf(initialRoles); }
    public InvitationStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getAcceptedAt() { return acceptedAt; }
    public Instant getRejectedAt() { return rejectedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
}
