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
                                Instant expiresAt, String rejectionMessage) {
    public static InvitationSummary from(ProjectInvitation invitation) {
        return new InvitationSummary(invitation.getId(), invitation.getProjectId(), invitation.getInvitedUserId(),
                invitation.getEmail(), invitation.getInvitedBy(), invitation.getInitialRoles(),
                invitation.getStatus(), invitation.getCreatedAt(), invitation.getExpiresAt(),
                invitation.getRejectionMessage());
    }
}
