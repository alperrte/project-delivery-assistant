package com.pda.auth.api.dto.response;

import java.time.Instant;
import java.util.UUID;

public record SessionResponse(UUID id, Instant createdAt, Instant lastUsedAt, Instant expiresAt,
                              String userAgent, boolean current) {}
