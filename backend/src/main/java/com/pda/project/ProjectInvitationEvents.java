package com.pda.project;

import java.util.UUID;

/** Immutable, scalar-only invitation events for notification consumers. */
public final class ProjectInvitationEvents {
    private ProjectInvitationEvents() {}
    public record Created(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy, String projectName) {
        public Created(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {
            this(invitationId, projectId, invitedUserId, invitedBy, null);
        }
    }
    /**
     * {@code teamId}/{@code membershipId} let the Squad module place the new member in the invited team within the
     * same transaction; {@code teamId} is null only for legacy invitations issued before teams were required.
     */
    public record Accepted(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy,
                           UUID teamId, UUID membershipId, String projectName) {
        public Accepted(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy,
                        UUID teamId, UUID membershipId) {
            this(invitationId, projectId, invitedUserId, invitedBy, teamId, membershipId, null);
        }
    }
    public record Rejected(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy, String projectName) {
        public Rejected(UUID invitationId, UUID projectId, UUID invitedUserId, UUID invitedBy) {
            this(invitationId, projectId, invitedUserId, invitedBy, null);
        }
    }
}
