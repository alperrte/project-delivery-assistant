package com.pda.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "refresh_token_hash", nullable = false, length = 64)
    private String refreshTokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    protected UserSession() {
        // JPA
    }

    public static UserSession open(UUID userId, String refreshToken, Instant expiresAt) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(expiresAt, "expiresAt");
        UserSession session = new UserSession();
        session.userId = userId;
        session.refreshTokenHash = hash(refreshToken);
        session.expiresAt = expiresAt;
        return session;
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public boolean matchesRefreshToken(String refreshToken) {
        return refreshToken != null && MessageDigest.isEqual(
                refreshTokenHash.getBytes(StandardCharsets.US_ASCII),
                hash(refreshToken).getBytes(StandardCharsets.US_ASCII));
    }

    public void rotate(String currentRefreshToken, String nextRefreshToken, Instant nextExpiresAt, Instant now) {
        if (!isActive(now) || !matchesRefreshToken(currentRefreshToken)) {
            throw new IllegalStateException("Session is not eligible for refresh");
        }
        if (!nextExpiresAt.isAfter(now)) {
            throw new IllegalArgumentException("Expiry must be in the future");
        }
        String nextHash = hash(nextRefreshToken);
        if (nextHash.equals(refreshTokenHash)) {
            throw new IllegalArgumentException("Refresh token must change");
        }
        refreshTokenHash = nextHash;
        expiresAt = nextExpiresAt;
        lastUsedAt = now;
    }

    public void revoke(Instant now) {
        Objects.requireNonNull(now, "now");
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    private static String hash(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Refresh token is required");
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getLastUsedAt() { return lastUsedAt; }
}
