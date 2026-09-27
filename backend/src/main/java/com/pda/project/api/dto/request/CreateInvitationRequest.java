package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

/** Exactly one of {@code userId} or {@code email} must be set; enforced by the controller (not Bean Validation). */
public record CreateInvitationRequest(UUID userId, @Email @Size(max = 320) String email,
                                      @NotEmpty Set<@NotNull ProjectRole> roles) {
}
