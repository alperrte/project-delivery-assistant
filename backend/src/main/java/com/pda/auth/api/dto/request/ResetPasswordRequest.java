package com.pda.auth.api.dto.request;

import com.pda.shared.StrongPassword;
import jakarta.validation.constraints.NotBlank;

/** Step three of forgot-password: the new password. The identity comes from the ticket cookie, not from the body. */
public record ResetPasswordRequest(
        @NotBlank @StrongPassword String newPassword,
        @NotBlank String confirmPassword
) {
    public boolean passwordsMatch() {
        return newPassword != null && newPassword.equals(confirmPassword);
    }
}
