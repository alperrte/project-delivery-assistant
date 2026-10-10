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

    static final int MAX_USER_AGENT_LENGTH = 255;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "refresh_token_hash", nullable = false, length = 64)
    private String refreshTokenHash;

    @Column(name = "previous_refresh_token_hash", length = 64)
    private String previousRefreshTokenHash;

    @Column(name = "user_agent", length = MAX_USER_AGENT_LENGTH)
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /** Set only when the session was opened by the administrator sign-in (password plus authenticator code). */
    @Column(name = "admin_verified_at", updatable = false)
    private Instant adminVerifiedAt;

    protected UserSession() {
        // JPA
    }

    public static UserSession open(UUID userId, String refreshToken, Instant expiresAt) {
        return open(userId, refreshToken, expiresAt, null);
    }

    public static UserSession open(UUID userId, String refreshToken, Instant expiresAt, String userAgent) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(expiresAt, "expiresAt");
        UserSession session = new UserSession();
        session.userId = userId;
        session.refreshTokenHash = hashRefreshToken(refreshToken);
        session.expiresAt = expiresAt;
        session.userAgent = sanitizeUserAgent(userAgent);
        return session;
    }

    /** A session opened by the administrator sign-in; only such a session may use the administrator API. */
    public static UserSession openAdminVerified(UUID userId, String refreshToken, Instant expiresAt, String userAgent,
                                                Instant verifiedAt) {
        UserSession session = open(userId, refreshToken, expiresAt, userAgent);
        session.adminVerifiedAt = Objects.requireNonNull(verifiedAt, "verifiedAt");
        return session;
    }

    private static String sanitizeUserAgent(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        String cleaned = userAgent.replaceAll("\\p{Cntrl}", " ").strip();
        if (cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() > MAX_USER_AGENT_LENGTH ? cleaned.substring(0, MAX_USER_AGENT_LENGTH) : cleaned;
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public boolean matchesRefreshToken(String refreshToken) {
        return refreshToken != null && MessageDigest.isEqual(
                refreshTokenHash.getBytes(StandardCharsets.US_ASCII),
                hashRefreshToken(refreshToken).getBytes(StandardCharsets.US_ASCII));
    }

    public boolean matchesPreviousRefreshToken(String refreshToken) {
        return refreshToken != null && previousRefreshTokenHash != null && MessageDigest.isEqual(
                previousRefreshTokenHash.getBytes(StandardCharsets.US_ASCII),
                hashRefreshToken(refreshToken).getBytes(StandardCharsets.US_ASCII));
    }

    public void rotate(String currentRefreshToken, String nextRefreshToken, Instant nextExpiresAt, Instant now) {
        if (!isActive(now) || !matchesRefreshToken(currentRefreshToken)) {
            throw new IllegalStateException("Session is not eligible for refresh");
        }
        if (!nextExpiresAt.isAfter(now)) {
            throw new IllegalArgumentException("Expiry must be in the future");
        }
        String nextHash = hashRefreshToken(nextRefreshToken);
        if (nextHash.equals(refreshTokenHash)) {
            throw new IllegalArgumentException("Refresh token must change");
        }
        previousRefreshTokenHash = refreshTokenHash;
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

    public static String hashRefreshToken(String token) {
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
    public String getUserAgent() { return userAgent; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public boolean isAdminVerified() { return adminVerifiedAt != null; }
}
