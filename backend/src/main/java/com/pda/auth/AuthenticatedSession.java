package com.pda.auth;

import java.time.Instant;
import java.util.UUID;

/**
 * Public Auth module contract: the session behind a request that the JWT cookie filter has just authenticated.
 *
 * <p>The filter stores it as the request attribute {@link #REQUEST_ATTRIBUTE}. A long-lived connection that starts
 * with an HTTP request (the chat WebSocket handshake) keeps it, so it can later ask whether that very session and
 * access token are still valid. {@code accessExpiresAt} is when the presented access token stops being valid.
 */
public record AuthenticatedSession(UUID userId, UUID sessionId, Instant accessExpiresAt) {

    public static final String REQUEST_ATTRIBUTE = AuthenticatedSession.class.getName();
}
