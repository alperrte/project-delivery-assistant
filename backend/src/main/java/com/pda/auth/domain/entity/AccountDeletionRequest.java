package com.pda.auth.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The mailed "do you really want to delete your account" link. Only the SHA-256 of the random token is stored. The link
 * is valid for 15 minutes, can be used once, and is cancelled by the fifth wrong confirmation.
 */
@Entity
@Table(name = "account_deletion_requests", uniqueConstraints = {
        @UniqueConstraint(name = "uk_account_deletion_requests_user", columnNames = "user_id"),
        @UniqueConstraint(name = "uk_account_deletion_requests_token", columnNames = "token_hash")
})
public class AccountDeletionRequest {

    private static final Duration LINK_LIFETIME = Duration.ofMinutes(15);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_sent_at", nullable = false)
    private Instant lastSentAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected AccountDeletionRequest() {
        // JPA
    }

    public static AccountDeletionRequest issue(UUID userId, String tokenHash, Instant now) {
        AccountDeletionRequest request = new AccountDeletionRequest();
        request.userId = Objects.requireNonNull(userId, "userId");
        request.tokenHash = requireHash(tokenHash);
        request.issuedAt = Objects.requireNonNull(now, "now");
        request.expiresAt = now.plus(LINK_LIFETIME);
        request.lastSentAt = now;
        return request;
    }

    public boolean canResend(Instant now) {
        return !lastSentAt.plus(RESEND_COOLDOWN).isAfter(now);
    }

    /** A new link replaces the old one, which stops working at once. */
    public void reissue(String replacementHash, Instant now) {
        if (!canResend(now)) {
            throw new IllegalStateException("Account deletion resend is unavailable");
        }
        tokenHash = requireHash(replacementHash);
        issuedAt = now;
        expiresAt = now.plus(LINK_LIFETIME);
        lastSentAt = now;
        attemptCount = 0;
        consumedAt = null;
    }

    public boolean isOpen(Instant now) {
        return consumedAt == null && expiresAt.isAfter(now) && attemptCount < MAX_ATTEMPTS;
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    /** Counts one wrong confirmation; the fifth one closes the link for good. */
    public void failedAttempt() {
        if (attemptCount < MAX_ATTEMPTS) {
            attemptCount++;
        }
    }

    public void consume(Instant now) {
        if (!isOpen(now)) {
            throw new IllegalStateException("Account deletion request is not open");
        }
        consumedAt = now;
    }

    private static String requireHash(String hash) {
        if (hash == null || !hash.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Account deletion token hash is invalid");
        }
        return hash;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getLastSentAt() { return lastSentAt; }
    public int getAttemptCount() { return attemptCount; }
    public Instant getConsumedAt() { return consumedAt; }
}
