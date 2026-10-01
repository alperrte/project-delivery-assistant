package com.pda.project.api.dto.request;

import com.pda.user.ProjectRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

/**
 * Exactly one of {@code userId} or {@code email} must be set; enforced by the controller (not Bean Validation).
 * {@code teamId} is the team the invitee joins on accepting; every member belongs to at least one team.
 */
public record CreateInvitationRequest(UUID userId, @Email @Size(max = 320) String email,
                                      @NotEmpty Set<@NotNull ProjectRole> roles,
                                      @Size(max = 100) String firstName, @Size(max = 100) String lastName,
                                      @Size(max = 100) String message, @NotNull UUID teamId) {
}
