package com.pda.project.api.dto.response;

import com.pda.project.application.service.ProjectInvitationService.CreatedInvitation;

import java.time.Instant;
import java.util.UUID;

/** The raw token is returned exactly once, here; it is never persisted and never appears in any other response. */
public record CreatedInvitationResponse(UUID invitationId, String token, Instant expiresAt) {
    public static CreatedInvitationResponse from(CreatedInvitation created) {
        return new CreatedInvitationResponse(created.invitation().getId(), created.rawToken(),
                created.invitation().getExpiresAt());
    }
}
