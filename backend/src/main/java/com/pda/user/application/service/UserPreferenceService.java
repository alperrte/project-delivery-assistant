package com.pda.user.application.service;

import com.pda.user.domain.entity.UserPreference;
import com.pda.user.domain.ThemeColors;
import com.pda.user.domain.ThemeAnimation;
import com.pda.user.infrastructure.repository.UserPreferenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Reads and saves the signed-in user's own interface defaults. Nobody can read or write another user's. */
@Service
public class UserPreferenceService {

    public static final Set<String> LOCALES = Set.of("tr", "en", "de");
    public static final Set<String> THEMES = Set.of("system", "light", "dark");
    public static final Set<String> MOTIONS = Set.of("system", "on", "off");
    public static final Set<String> NAVBAR_MODES = Set.of("always-visible", "auto-hide");

    /** Legacy nullable fields mean not chosen yet; themeColors always contains the saved values or safe defaults. */
    public record Preferences(String locale, String theme, String motion, Boolean themeTransition,
                              Boolean languageTransition, String navbarMode, ThemeColors themeColors, ThemeAnimation themeAnimation) {
    }

    private final UserPreferenceRepository preferences;
    private final Clock clock;

    public UserPreferenceService(UserPreferenceRepository preferences, Clock clock) {
        this.preferences = preferences;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Preferences get(UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        Optional<UserPreference> saved = preferences.findById(userId);
        return saved.map(UserPreferenceService::view)
                .orElseGet(() -> new Preferences(null, null, null, null, null, null, ThemeColors.DEFAULT, ThemeAnimation.DEFAULT));
    }

    @Transactional
    public Preferences save(UUID userId, String locale, String theme, String motion, boolean themeTransition, String navbarMode) {
        return save(userId, locale, theme, motion, themeTransition, null, navbarMode);
    }

    @Transactional
    public Preferences save(UUID userId, String locale, String theme, String motion, boolean themeTransition,
                            Boolean languageTransition, String navbarMode) {
        return save(userId, locale, theme, motion, themeTransition, languageTransition, navbarMode, null);
    }

    @Transactional
    public Preferences save(UUID userId, String locale, String theme, String motion, boolean themeTransition,
                            Boolean languageTransition, String navbarMode, ThemeColors themeColors) {
        return save(userId, locale, theme, motion, themeTransition, languageTransition, navbarMode, themeColors, null);
    }

    @Transactional
    public Preferences save(UUID userId, String locale, String theme, String motion, boolean themeTransition,
                            Boolean languageTransition, String navbarMode, ThemeColors themeColors, ThemeAnimation themeAnimation) {
        Objects.requireNonNull(userId, "userId is required");
        if (locale == null || theme == null || motion == null
                || !LOCALES.contains(locale) || !THEMES.contains(theme) || !MOTIONS.contains(motion)
                || (navbarMode != null && !NAVBAR_MODES.contains(navbarMode))) {
            throw new IllegalArgumentException("Unsupported preference value");
        }
        UserPreference preference = lock(userId);
        boolean langTransition = languageTransition != null
                ? languageTransition
                : (preference.getLanguageTransition() != null ? preference.getLanguageTransition() : true);
        preference.replace(locale, theme, motion, themeTransition, langTransition, clock.instant());
        // Old clients must not reset a choice saved by a newer client.
        if (navbarMode != null) preference.setNavbarMode(navbarMode);
        if (themeColors != null) preference.setThemeColors(themeColors, clock.instant());
        if (themeAnimation != null) preference.setThemeAnimation(themeAnimation, clock.instant());
        return view(preferences.save(preference));
    }

    /** Resets color and animation settings only; other interface preferences remain exactly as saved. */
    @Transactional
    public Preferences resetTheme(UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        UserPreference preference = lock(userId);
        preference.setThemeColors(ThemeColors.DEFAULT, clock.instant());
        preference.setThemeAnimation(ThemeAnimation.DEFAULT, clock.instant());
        return view(preferences.save(preference));
    }

    private UserPreference lock(UUID userId) {
        preferences.ensureExists(userId, clock.instant());
        return preferences.lockByUserId(userId);
    }

    private static Preferences view(UserPreference preference) {
        return new Preferences(preference.getLocale(), preference.getTheme(), preference.getMotion(),
                preference.getThemeTransition(), preference.getLanguageTransition(), preference.getNavbarMode(),
                preference.getThemeColors(), preference.getThemeAnimation());
    }
}
