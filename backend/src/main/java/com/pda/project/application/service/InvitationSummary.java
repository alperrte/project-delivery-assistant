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
                                String message, String nickname, UUID teamId, String teamName,
                                String invitedByNickname, Long invitedByPhotoVersion, Long profilePhotoVersion) {

    /** Same invitation with a different status; used to report a lapsed pending invitation as expired. */
    public InvitationSummary withStatus(InvitationStatus newStatus) {
        return new InvitationSummary(id, projectId, invitedUserId, email, invitedBy, initialRoles, newStatus, createdAt,
                expiresAt, rejectionMessage, firstName, lastName, message, nickname, teamId, teamName,
                invitedByNickname, invitedByPhotoVersion, profilePhotoVersion);
    }

    public static InvitationSummary from(ProjectInvitation invitation) {
        return from(invitation, null, null);
    }

    public static InvitationSummary from(ProjectInvitation invitation, String nickname, String teamName) {
        return from(invitation, nickname, teamName, null, null, null);
    }

    public static InvitationSummary from(ProjectInvitation invitation, String nickname, String teamName,
                                         String invitedByNickname, Long invitedByPhotoVersion, Long profilePhotoVersion) {
        return new InvitationSummary(invitation.getId(), invitation.getProjectId(), invitation.getInvitedUserId(),
                invitation.getEmail(), invitation.getInvitedBy(), invitation.getInitialRoles(),
                invitation.getStatus(), invitation.getCreatedAt(), invitation.getExpiresAt(),
                invitation.getRejectionMessage(), invitation.getInviteeFirstName(),
                invitation.getInviteeLastName(), invitation.getMessage(), nickname,
                invitation.getTeamId(), teamName, invitedByNickname, invitedByPhotoVersion, profilePhotoVersion);
    }
}
