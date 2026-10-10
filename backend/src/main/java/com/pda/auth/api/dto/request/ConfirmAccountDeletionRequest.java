package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The public deletion page: the token from the mailed link plus the proof of who is behind it. The password is empty
 * for accounts that sign in through a provider only; the code is needed only when two-factor is on.
 */
public record ConfirmAccountDeletionRequest(
        @NotBlank @Size(max = 128) String token,
        @NotBlank @Email @Size(max = 320) String email,
        @Size(max = 128) String password,
        @Size(max = 32) String code
) {
}
