package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Switching two-factor off needs a current code and, for accounts that have one, the password. */
public record DisableTwoFactorRequest(
        @Size(max = 128) String password,
        @NotBlank @Size(max = 32) String code
) {
}
