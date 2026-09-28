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
 * A hashed, expiring, attempt-limited password reset code — the same shape and rules as
 * {@link EmailVerificationChallenge}, kept as a separate entity/table because it is issued after proof of
 * identity has already changed (an active account requesting a credential reset) rather than during signup.
 */
@Entity
@Table(name = "password_reset_challenges", uniqueConstraints =
        @UniqueConstraint(name = "uk_password_reset_challenges_user", columnNames = "user_id"))
public class PasswordResetChallenge {

    private static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

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

    protected PasswordResetChallenge() {
        // JPA
    }

    public static PasswordResetChallenge issue(UUID userId, String codeHash, Instant now) {
        PasswordResetChallenge challenge = new PasswordResetChallenge();
        challenge.userId = Objects.requireNonNull(userId, "userId");
        challenge.codeHash = requireHash(codeHash);
        challenge.issuedAt = Objects.requireNonNull(now, "now");
        challenge.expiresAt = now.plus(CODE_LIFETIME);
        challenge.lastSentAt = now;
        return challenge;
    }

    public boolean canResend(Instant now) {
        return consumedAt == null && !lastSentAt.plus(RESEND_COOLDOWN).isAfter(now);
    }

    public void resend(String replacementHash, Instant now) {
        if (!canResend(now)) {
            throw new IllegalStateException("Password reset resend is unavailable");
        }
        codeHash = requireHash(replacementHash);
        issuedAt = now;
        expiresAt = now.plus(CODE_LIFETIME);
        lastSentAt = now;
        attemptCount = 0;
    }

    public AttemptResult attempt(String candidateHash, Instant now) {
        if (consumedAt != null) {
            return AttemptResult.CONSUMED;
        }
        if (!expiresAt.isAfter(now)) {
            return AttemptResult.EXPIRED;
        }
        if (attemptCount >= MAX_ATTEMPTS) {
            return AttemptResult.TOO_MANY_ATTEMPTS;
        }
        if (!java.security.MessageDigest.isEqual(codeHash.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                requireHash(candidateHash).getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
            attemptCount++;
            return AttemptResult.WRONG;
        }
        consumedAt = now;
        return AttemptResult.VERIFIED;
    }

    private static String requireHash(String hash) {
        if (hash == null || !hash.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Password reset hash is invalid");
        }
        return hash;
    }

    public enum AttemptResult { VERIFIED, WRONG, EXPIRED, CONSUMED, TOO_MANY_ATTEMPTS }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getLastSentAt() { return lastSentAt; }
    public int getAttemptCount() { return attemptCount; }
    public Instant getConsumedAt() { return consumedAt; }
}
