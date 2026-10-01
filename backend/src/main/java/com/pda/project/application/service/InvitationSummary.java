package com.pda.project.application.service;

import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Eagerly resolves {@link ProjectInvitation#getInitialRoles()} while the persistence session is still open.
 * {@code spring.jpa.open-in-view=false} means a lazy {@code @ElementCollection} loaded fresh from a query (unlike
 * one populated in memory before the first save) can only be read inside the owning {@code @Transactional} method;
 * mapping to this record there — mirroring {@link MemberSummary} — is what makes it safe for a controller to read
 * afterward.
 */
public record InvitationSummary(UUID id, UUID projectId, UUID invitedUserId, String email, UUID invitedBy,
                                Set<ProjectRole> initialRoles, InvitationStatus status, Instant createdAt,
                                Instant expiresAt, String rejectionMessage, String firstName, String lastName,
                                String message, String nickname) {
    public InvitationSummary(UUID id, UUID projectId, UUID invitedUserId, String email, UUID invitedBy,
                             Set<ProjectRole> initialRoles, InvitationStatus status, Instant createdAt,
                             Instant expiresAt, String rejectionMessage, String firstName, String lastName,
                             String message) {
        this(id, projectId, invitedUserId, email, invitedBy, initialRoles, status, createdAt,
                expiresAt, rejectionMessage, firstName, lastName, message, null);
    }
    public InvitationSummary(UUID id, UUID projectId, UUID invitedUserId, String email, UUID invitedBy,
                             Set<ProjectRole> initialRoles, InvitationStatus status, Instant createdAt,
                             Instant expiresAt, String rejectionMessage) {
        this(id, projectId, invitedUserId, email, invitedBy, initialRoles, status, createdAt,
                expiresAt, rejectionMessage, null, null, null, null);
    }
    public static InvitationSummary from(ProjectInvitation invitation) {
        return from(invitation, null);
    }

    public static InvitationSummary from(ProjectInvitation invitation, String nickname) {
        return new InvitationSummary(invitation.getId(), invitation.getProjectId(), invitation.getInvitedUserId(),
                invitation.getEmail(), invitation.getInvitedBy(), invitation.getInitialRoles(),
                invitation.getStatus(), invitation.getCreatedAt(), invitation.getExpiresAt(),
                invitation.getRejectionMessage(), invitation.getInviteeFirstName(),
                invitation.getInviteeLastName(), invitation.getMessage(), nickname);
    }
}
