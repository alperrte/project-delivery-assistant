package com.pda.project;

import java.time.Instant;
import java.util.UUID;

public record ProjectMemberRemovedEvent(UUID projectId, UUID userId, UUID removedBy, Instant occurredAt) {}
