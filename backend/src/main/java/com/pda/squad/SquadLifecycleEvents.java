package com.pda.squad;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Immutable public lifecycle snapshots; no consumer depends on Squad persistence classes. */
public final class SquadLifecycleEvents {
    private SquadLifecycleEvents() {}

    public record TeamDeleted(UUID eventId, UUID projectId, String projectName, UUID teamId, String teamName,
                              UUID deletedBy, String actorNickname, Set<UUID> recipientIds, Instant occurredAt) {
        public TeamDeleted {
            Objects.requireNonNull(eventId);
            Objects.requireNonNull(projectId);
            Objects.requireNonNull(teamId);
            Objects.requireNonNull(deletedBy);
            Objects.requireNonNull(occurredAt);
            recipientIds = Set.copyOf(recipientIds);
        }
    }
}
