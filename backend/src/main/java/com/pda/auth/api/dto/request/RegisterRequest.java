package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.pda.shared.StrongPassword;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Pattern(regexp = "[\\p{L}\\p{N}_]{3,32}") String nickname,
        @NotBlank @StrongPassword String password,
        @NotBlank String confirmPassword,
        @Size(max = 8) String locale
) {
    public boolean passwordsMatch() {
        return password != null && password.equals(confirmPassword);
    }
}
