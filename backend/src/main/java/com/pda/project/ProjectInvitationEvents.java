package com.pda.project;

import java.util.UUID;

/** Immutable, scalar-only invitation events for notification consumers. */
public final class ProjectInvitationEvents {
    private ProjectInvitationEvents() {}
    public record Created(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {}
    public record Accepted(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {}
    public record Rejected(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {}
}
