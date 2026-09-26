package com.pda.user;

import java.time.Instant;
import java.util.UUID;

/** Public User module contract for Auth session use cases. */
public interface UserSessions {
    UUID open(UUID userId, String refreshToken, Instant expiresAt);
    boolean isActive(UUID sessionId, UUID userId, Instant now);
    boolean revoke(UUID userId, String refreshToken, Instant now);
}
