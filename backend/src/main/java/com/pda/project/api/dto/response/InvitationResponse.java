package com.pda.project.api.dto.response;

import com.pda.project.application.service.InvitationSummary;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Never carries the raw token; see {@link CreatedInvitationResponse} for the once-only token response. */
public record InvitationResponse(UUID id, UUID projectId, UUID invitedUserId, String email, UUID invitedBy,
                                 Set<ProjectRole> initialRoles, InvitationStatus status, Instant createdAt,
                                 Instant expiresAt, String rejectionMessage, String firstName, String lastName,
                                 String message, String nickname, UUID teamId, String teamName) {
    public static InvitationResponse from(InvitationSummary summary) {
        return new InvitationResponse(summary.id(), summary.projectId(), summary.invitedUserId(), summary.email(),
                summary.invitedBy(), summary.initialRoles(), summary.status(), summary.createdAt(),
                summary.expiresAt(), summary.rejectionMessage(), summary.firstName(), summary.lastName(),
                summary.message(), summary.nickname(), summary.teamId(), summary.teamName());
    }
}
