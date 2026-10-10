package com.pda.user.api;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.pda.user.UserAccounts;
import com.pda.user.NicknameRules;
import com.pda.user.application.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/profile")
public class UserProfileController {
    private final UserProfileService profiles;
    public UserProfileController(UserProfileService profiles) { this.profiles = profiles; }
    public record ProfileRequest(@NotBlank @Pattern(regexp = NicknameRules.REGEX) String nickname) {
        public ProfileRequest { nickname = NicknameRules.normalize(nickname); }
        @JsonAnySetter
        public void rejectUnknown(String name, Object value) { throw new IllegalArgumentException("Unsupported profile field"); }
    }
    @PutMapping
    @Operation(summary = "Update my nickname", description = "Current active session only; requires CSRF. Nickname: Unicode letters, digits, underscore, hyphen and single spaces between words, 3-32 characters; leading/trailing whitespace is trimmed, consecutive spaces and other whitespace/control characters are rejected; case-sensitive unique. No other profile or identity fields accepted.")
    public ResponseEntity<UserAccounts.AuthenticatedUser> update(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @Valid @RequestBody ProfileRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(profiles.rename(principal.id(), request.nickname()));
    }
}
