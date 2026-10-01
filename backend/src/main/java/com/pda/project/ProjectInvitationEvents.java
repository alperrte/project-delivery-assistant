package com.pda.project;

import java.util.UUID;

/** Immutable, scalar-only invitation events for notification consumers. */
public final class ProjectInvitationEvents {
    private ProjectInvitationEvents() {}
    public record Created(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {}
    /**
     * {@code teamId}/{@code membershipId} let the Squad module place the new member in the invited team within the
     * same transaction; {@code teamId} is null only for legacy invitations issued before teams were required.
     */
    public record Accepted(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy,
                           UUID teamId, UUID membershipId) {}
    public record Rejected(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {}
}
