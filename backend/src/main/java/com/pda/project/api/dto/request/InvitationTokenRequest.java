package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvitationTokenRequest(@NotBlank @Size(max = 200) String token) {
}
