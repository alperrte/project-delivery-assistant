package com.pda.user.api;

import com.pda.user.UserAccounts;
import com.pda.user.application.service.UserPreferenceService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's saved interface defaults (the Settings page). Always about the caller, never another user. */
@RestController
@RequestMapping("/api/v1/users/me/preferences")
public class UserPreferenceController {

    private final UserPreferenceService preferences;

    public UserPreferenceController(UserPreferenceService preferences) {
        this.preferences = preferences;
    }

    public record PreferencesRequest(
            @NotNull @Pattern(regexp = "tr|en|de") String locale,
            @NotNull @Pattern(regexp = "system|light|dark") String theme,
            @NotNull @Pattern(regexp = "system|on|off") String motion,
            @NotNull Boolean themeTransition) {
    }

    @GetMapping
    @Operation(summary = "Get my saved interface defaults",
            description = "Language, theme, animation and theme-transition choices saved on the Settings page; a field "
                    + "is absent until the user has saved. Requires a valid access cookie.")
    public ResponseEntity<UserPreferenceService.Preferences> get(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(preferences.get(principal.id()));
    }

    @PutMapping
    @Operation(summary = "Save my interface defaults",
            description = "Replaces all four choices at once. They apply at every sign-in; the header switches stay "
                    + "temporary. Requires CSRF.")
    public ResponseEntity<UserPreferenceService.Preferences> save(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody PreferencesRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(preferences.save(principal.id(),
                request.locale(), request.theme(), request.motion(), request.themeTransition()));
    }
}
