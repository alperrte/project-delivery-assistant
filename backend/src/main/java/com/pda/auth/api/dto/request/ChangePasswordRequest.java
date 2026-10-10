package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.pda.shared.StrongPassword;

public record ChangePasswordRequest(
        @NotBlank @Size(max = 128) String currentPassword,
        @NotBlank @StrongPassword String newPassword,
        @NotBlank String confirmNewPassword
) {
    public boolean passwordsMatch() {
        return newPassword != null && newPassword.equals(confirmNewPassword);
    }
}
