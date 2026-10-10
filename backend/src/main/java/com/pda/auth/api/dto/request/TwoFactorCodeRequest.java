package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A 6-digit authenticator code or a backup code (spaces and dashes are tolerated and stripped by the service). */
public record TwoFactorCodeRequest(@NotBlank @Size(max = 32) String code) {
}
