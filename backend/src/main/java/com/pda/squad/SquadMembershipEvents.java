package com.pda.squad;

import java.time.Instant;
import java.util.UUID;

/** Public scalar-only squad membership events. */
public final class SquadMembershipEvents {
    private SquadMembershipEvents() {}
    public record MemberAdded(UUID squadId, UUID projectId, UUID userId, UUID addedBy, Instant occurredAt) {}
    public record MemberRemoved(UUID squadId, UUID projectId, UUID userId, UUID removedBy, Instant occurredAt) {}
}
