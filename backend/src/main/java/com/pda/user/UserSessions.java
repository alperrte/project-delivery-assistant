package com.pda.user;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Public User module contract for Auth session use cases. */
public interface UserSessions {
    UUID open(UUID userId, String refreshToken, Instant expiresAt, String userAgent);

    /**
     * Opens a session that was proven by the administrator sign-in (password plus authenticator code). Only such a
     * session passes {@link #isAdminVerified}; refresh rotation keeps the mark because the session row is the same.
     */
    UUID openAdminVerified(UUID userId, String refreshToken, Instant expiresAt, String userAgent, Instant now);

    /** True when this active session of the user was opened by the administrator sign-in. */
    boolean isAdminVerified(UUID sessionId, UUID userId, Instant now);
    boolean isActive(UUID sessionId, UUID userId, Instant now);
    boolean revoke(UUID userId, String refreshToken, Instant now);

    /**
     * Atomically replaces the session's refresh token when {@code currentRefreshToken} belongs to an
     * active session of {@code userId}. Returns the session id, or empty when rotation is not allowed.
     */
    Optional<UUID> rotate(UUID userId, String currentRefreshToken, String nextRefreshToken,
                          Instant nextExpiresAt, Instant now);

    /** Active (not revoked, not expired) sessions of the user, newest first. */
    List<SessionView> listActive(UUID userId, Instant now);

    /** Revokes one session owned by {@code userId}; false when it does not exist, is not owned or is inactive. */
    boolean revokeById(UUID userId, UUID sessionId, Instant now);

    /** Revokes every active session of the user except {@code currentSessionId}; returns the revoked count. */
    int revokeOthers(UUID userId, UUID currentSessionId, Instant now);

    /** Revokes every active session of the user; returns the revoked count. */
    int revokeAll(UUID userId, Instant now);

    long countActive(UUID userId, Instant now);

    /** Active (not revoked, not expired) sessions of every account; for the administrator system status. */
    long countAllActive(Instant now);

    record SessionView(UUID id, Instant createdAt, Instant lastUsedAt, Instant expiresAt, String userAgent) {}
}
