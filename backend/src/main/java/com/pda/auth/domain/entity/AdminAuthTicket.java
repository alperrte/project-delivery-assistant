package com.pda.auth.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The server-side half of an administrator sign-in ticket. The signed cookie only names this row; the row decides
 * whether the ticket is still good: it is bound to one account and one purpose, expires, and can be consumed once.
 */
@Entity
@Table(name = "admin_auth_tickets")
public class AdminAuthTicket {

    /** What the ticket allows: the authenticator step of a sign-in, or the first-time authenticator enrolment. */
    public enum Purpose { ADMIN_MFA, ADMIN_ENROLL }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private Purpose purpose;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    protected AdminAuthTicket() {
        // JPA
    }

    public static AdminAuthTicket issue(UUID userId, Purpose purpose, Instant now, Instant expiresAt) {
        AdminAuthTicket ticket = new AdminAuthTicket();
        ticket.userId = Objects.requireNonNull(userId, "userId");
        ticket.purpose = Objects.requireNonNull(purpose, "purpose");
        ticket.createdAt = Objects.requireNonNull(now, "now");
        ticket.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt");
        return ticket;
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null && expiresAt.isAfter(now);
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Purpose getPurpose() { return purpose; }
    public Instant getExpiresAt() { return expiresAt; }
}
