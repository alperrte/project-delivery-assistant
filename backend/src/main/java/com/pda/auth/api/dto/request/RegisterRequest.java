package com.pda.auth.api.dto.request;

import com.pda.user.NicknameRules;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Pattern(regexp = NicknameRules.REGEX) String nickname,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank String confirmPassword
) {
    public RegisterRequest {
        nickname = NicknameRules.normalize(nickname);
    }

    public boolean passwordsMatch() {
        return password != null && password.equals(confirmPassword);
    }
}
