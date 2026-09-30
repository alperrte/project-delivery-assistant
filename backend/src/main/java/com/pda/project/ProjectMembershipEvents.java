package com.pda.project;

import java.time.Instant;
import java.util.UUID;

/** Public scalar-only membership events. */
public final class ProjectMembershipEvents {
    private ProjectMembershipEvents() {}
    public record MemberAdded(UUID projectId, UUID userId, UUID addedBy, Instant occurredAt) {}
    public record RolesChanged(UUID projectId, UUID userId, UUID changedBy, Instant occurredAt) {}
    /** Used by Teams to remove association rows in the same business transaction. */
    public record MemberRemoved(UUID projectId, UUID membershipId) {}
}
