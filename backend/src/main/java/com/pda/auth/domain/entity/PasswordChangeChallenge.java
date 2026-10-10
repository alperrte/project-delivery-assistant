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
 * A hashed, expiring, attempt-limited code mailed to a signed-in user before the account settings let them change
 * their password. Same rules as {@link PasswordResetChallenge}; kept apart so a pending reset and a pending change
 * never overwrite each other's code.
 */
@Entity
@Table(name = "password_change_challenges", uniqueConstraints =
        @UniqueConstraint(name = "uk_password_change_challenges_user", columnNames = "user_id"))
public class PasswordChangeChallenge {

    private static final Duration CODE_LIFETIME = Duration.ofMinutes(15);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;
    /** Wrong guesses across all codes of the account inside this window block the reset until the window ends. */
    private static final Duration FAILURE_WINDOW = Duration.ofHours(1);
    private static final int MAX_WINDOW_FAILURES = 5;

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

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "window_failures", nullable = false)
    private int windowFailures;

    @Column(name = "failure_window_started_at")
    private Instant failureWindowStartedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected PasswordChangeChallenge() {
        // JPA
    }

    public static PasswordChangeChallenge issue(UUID userId, String codeHash, Instant now) {
        PasswordChangeChallenge challenge = new PasswordChangeChallenge();
        challenge.userId = Objects.requireNonNull(userId, "userId");
        challenge.codeHash = requireHash(codeHash);
        challenge.issuedAt = Objects.requireNonNull(now, "now");
        challenge.expiresAt = now.plus(CODE_LIFETIME);
        challenge.lastSentAt = now;
        return challenge;
    }

    /**
     * A used (consumed) challenge is just a finished one: the user may ask for a new code at any time, so only the
     * cooldown since the last mail matters.
     */
    public boolean canResend(Instant now) {
        return !lastSentAt.plus(RESEND_COOLDOWN).isAfter(now);
    }

    public void resend(String replacementHash, Instant now) {
        if (!canResend(now)) {
            throw new IllegalStateException("Password change resend is unavailable");
        }
        codeHash = requireHash(replacementHash);
        issuedAt = now;
        expiresAt = now.plus(CODE_LIFETIME);
        lastSentAt = now;
        attemptCount = 0;
        if (consumedAt != null) {
            // A finished reset starts over; an unfinished one keeps counting, so asking for a new code is no way
            // around the limit.
            windowFailures = 0;
            failureWindowStartedAt = null;
        }
        consumedAt = null;
        completedAt = null;
    }

    /**
     * The code was accepted (consumed) and the new password has not been set yet: the ticket that was handed out for
     * this code may be used, once. A newer code ({@link #resend}) changes {@code issuedAt} and so retires the ticket.
     */
    public boolean ticketUsable(Instant ticketIssuedAt) {
        return consumedAt != null && completedAt == null && issuedAt.equals(ticketIssuedAt);
    }

    public void complete(Instant now) {
        if (consumedAt == null || completedAt != null) {
            throw new IllegalStateException("Password change cannot be completed");
        }
        completedAt = now;
    }

    /** True while too many wrong guesses were made within the last hour: no code is accepted, even a correct one. */
    public boolean isBlocked(Instant now) {
        return windowFailures >= MAX_WINDOW_FAILURES && failureWindowStartedAt != null
                && failureWindowStartedAt.plus(FAILURE_WINDOW).isAfter(now);
    }

    public AttemptResult attempt(String candidateHash, Instant now) {
        if (consumedAt != null) {
            return AttemptResult.CONSUMED;
        }
        if (!expiresAt.isAfter(now)) {
            return AttemptResult.EXPIRED;
        }
        if (isBlocked(now) || attemptCount >= MAX_ATTEMPTS) {
            return AttemptResult.TOO_MANY_ATTEMPTS;
        }
        if (!java.security.MessageDigest.isEqual(codeHash.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                requireHash(candidateHash).getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
            attemptCount++;
            if (failureWindowStartedAt == null || !failureWindowStartedAt.plus(FAILURE_WINDOW).isAfter(now)) {
                failureWindowStartedAt = now;
                windowFailures = 0;
            }
            windowFailures++;
            return AttemptResult.WRONG;
        }
        consumedAt = now;
        return AttemptResult.VERIFIED;
    }

    private static String requireHash(String hash) {
        if (hash == null || !hash.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Password change hash is invalid");
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
    public Instant getCompletedAt() { return completedAt; }
}
