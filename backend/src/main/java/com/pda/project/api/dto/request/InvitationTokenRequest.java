package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotBlank;

public record InvitationTokenRequest(@NotBlank String token) {
}
