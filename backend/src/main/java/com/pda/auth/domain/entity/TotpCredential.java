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
 * A user's authenticator-app secret. It is "pending" until the first code is proven, and only a confirmed credential
 * is asked for at sign-in. Wrong codes are counted: five in a row lock the credential for 15 minutes.
 */
@Entity
@Table(name = "totp_credentials", uniqueConstraints =
        @UniqueConstraint(name = "uk_totp_credentials_user", columnNames = "user_id"))
public class TotpCredential {

    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK = Duration.ofMinutes(15);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "secret_encrypted", nullable = false, length = 255)
    private String secretEncrypted;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "last_used_step", nullable = false)
    private long lastUsedStep;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected TotpCredential() {
        // JPA
    }

    public static TotpCredential pending(UUID userId, String secretEncrypted, Instant now) {
        TotpCredential credential = new TotpCredential();
        credential.userId = Objects.requireNonNull(userId, "userId");
        credential.secretEncrypted = Objects.requireNonNull(secretEncrypted, "secretEncrypted");
        credential.createdAt = Objects.requireNonNull(now, "now");
        return credential;
    }

    public boolean isConfirmed() {
        return confirmedAt != null;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    /** A new secret for a setup that was never finished (scanning the QR code again). */
    public void replaceSecret(String replacement, Instant now) {
        if (isConfirmed()) {
            throw new IllegalStateException("A confirmed credential keeps its secret");
        }
        secretEncrypted = Objects.requireNonNull(replacement, "replacement");
        createdAt = now;
        failedAttempts = 0;
        lockedUntil = null;
        lastUsedStep = 0;
    }

    public void confirm(long step, Instant now) {
        confirmedAt = now;
        accept(step);
    }

    /** The code was right: remember its step so it cannot be used again, and clear the failure count. */
    public void accept(long step) {
        lastUsedStep = step;
        failedAttempts = 0;
        lockedUntil = null;
    }

    public void fail(Instant now) {
        if (lockedUntil != null && !lockedUntil.isAfter(now)) {
            lockedUntil = null;
            failedAttempts = 0;
        }
        failedAttempts++;
        if (failedAttempts >= MAX_FAILURES) {
            lockedUntil = now.plus(LOCK);
        }
    }

    /** A backup code was used: the failure count starts over, but no TOTP step is consumed. */
    public void clearFailures() {
        failedAttempts = 0;
        lockedUntil = null;
    }

    public UUID getUserId() { return userId; }
    public String getSecretEncrypted() { return secretEncrypted; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public long getLastUsedStep() { return lastUsedStep; }
    public int getFailedAttempts() { return failedAttempts; }
    public Instant getLockedUntil() { return lockedUntil; }
}
