package com.pda.user.api;

import com.pda.user.UserAccounts;
import com.pda.user.application.service.UserPreferenceService;
import com.pda.user.domain.ThemeColors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/** The signed-in user's saved interface defaults (the Settings page). Always about the caller, never another user. */
@RestController
@RequestMapping("/api/v1/users/me/preferences")
@ApiResponses({
        @ApiResponse(responseCode = "401", description = "No valid session", content = @Content(
                mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Missing CSRF token on a mutation or access denied", content = @Content(
                mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
})
public class UserPreferenceController {

    private final UserPreferenceService preferences;

    public UserPreferenceController(UserPreferenceService preferences) {
        this.preferences = preferences;
    }

    public record PreferencesRequest(
            @NotNull @Pattern(regexp = "tr|en|de") String locale,
            @NotNull @Pattern(regexp = "system|light|dark") String theme,
            @NotNull @Pattern(regexp = "system|on|off") String motion,
            @NotNull Boolean themeTransition,
            Boolean languageTransition,
            @Pattern(regexp = "always-visible|auto-hide") String navbarMode,
            @Valid ThemeColorsRequest themeColors) {
    }

    @Schema(description = "Complete opaque sRGB color settings. All five fields are required when themeColors is supplied. "
            + "#RGB and #RRGGBB are accepted and returned as uppercase #RRGGBB. Independent of light/dark/system.")
    public record ThemeColorsRequest(
            @NotNull @Pattern(regexp = "SOLID|GRADIENT")
            @Schema(example = "SOLID", allowableValues = {"SOLID", "GRADIENT"}) String themeType,
            @NotNull @Pattern(regexp = ThemeColors.HEX_PATTERN) @Schema(example = "#1B5FE0") String solidColor,
            @NotNull @Pattern(regexp = ThemeColors.HEX_PATTERN) @Schema(example = "#1B5FE0") String gradientStartColor,
            @NotNull @Pattern(regexp = ThemeColors.HEX_PATTERN) @Schema(example = "#8B5CF6") String gradientEndColor,
            @NotNull @Min(0) @Max(360) @Digits(integer = 3, fraction = 0)
            @Schema(type = "integer", example = "135") BigDecimal gradientAngle) {
        ThemeColors colors() {
            return new ThemeColors(themeType, solidColor, gradientStartColor, gradientEndColor, gradientAngle.intValueExact());
        }
    }

    @GetMapping
    @Operation(summary = "Get my saved interface defaults",
            description = "Language, theme, animation, theme-transition, language-transition and navbar choices saved on the Settings page; a field "
                    + "is absent until the user has saved. themeColors always has safe defaults (SOLID, #1B5FE0, "
                    + "#1B5FE0, #8B5CF6, 135). Own principal only; requires a valid access cookie (401 otherwise).")
    public ResponseEntity<UserPreferenceService.Preferences> get(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(preferences.get(principal.id()));
    }

    @PutMapping
    @ApiResponse(responseCode = "400", description = "Invalid preference or incomplete/invalid themeColors", content = @Content(
            mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    @Operation(summary = "Save my interface defaults",
            description = "Replaces interface defaults. Omitted/null navbarMode or languageTransition preserves the previous choice "
                    + "for older clients. Omitted/null themeColors also preserves saved colors. When supplied all five color fields "
                    + "are required; arbitrary opaque HEX colors and angles 0–360 are accepted. Only SOLID/GRADIENT. "
                    + "200 saved preferences, 400 invalid input, 401 no session, 403 missing CSRF. Actor is the principal.")
    public ResponseEntity<UserPreferenceService.Preferences> save(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody PreferencesRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(preferences.save(principal.id(),
                request.locale(), request.theme(), request.motion(), request.themeTransition(),
                request.languageTransition(), request.navbarMode(),
                request.themeColors() == null ? null : request.themeColors().colors()));
    }

    @DeleteMapping("/theme")
    @Operation(summary = "Reset my theme colors",
            description = "Resets only themeColors to SOLID / #1B5FE0 / #1B5FE0 / #8B5CF6 / 135. "
                    + "Preserves light/dark/system, locale, motion, transitions and navbar. No body or user id. "
                    + "Returns 200 full preferences; 401 no session, 403 missing CSRF. Own principal only.")
    public ResponseEntity<UserPreferenceService.Preferences> resetTheme(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(preferences.resetThemeColors(principal.id()));
    }
}
