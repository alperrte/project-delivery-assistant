package com.pda.auth.api.dto.request;

import com.pda.user.NicknameRules;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.pda.shared.StrongPassword;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Pattern(regexp = NicknameRules.REGEX) String nickname,
        @NotBlank @StrongPassword String password,
        @NotBlank String confirmPassword,
        @Size(max = 8) String locale
) {
    public RegisterRequest {
        nickname = NicknameRules.normalize(nickname);
    }

    public boolean passwordsMatch() {
        return password != null && password.equals(confirmPassword);
    }
}
