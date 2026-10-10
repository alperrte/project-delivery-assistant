package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResendVerificationRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @Size(max = 8) String locale
) {
}
