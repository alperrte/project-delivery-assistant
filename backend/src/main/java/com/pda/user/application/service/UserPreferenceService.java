package com.pda.user.application.service;

import com.pda.user.domain.entity.UserPreference;
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

    /** Nullable fields mean the user has not chosen yet. */
    public record Preferences(String locale, String theme, String motion, Boolean themeTransition) {
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
        return saved.map(UserPreferenceService::view).orElseGet(() -> new Preferences(null, null, null, null));
    }

    @Transactional
    public Preferences save(UUID userId, String locale, String theme, String motion, boolean themeTransition) {
        Objects.requireNonNull(userId, "userId is required");
        if (!LOCALES.contains(locale) || !THEMES.contains(theme) || !MOTIONS.contains(motion)) {
            throw new IllegalArgumentException("Unsupported preference value");
        }
        UserPreference preference = preferences.findById(userId).orElse(null);
        if (preference == null) {
            preference = UserPreference.of(userId, locale, theme, motion, themeTransition, clock.instant());
        } else {
            preference.replace(locale, theme, motion, themeTransition, clock.instant());
        }
        return view(preferences.save(preference));
    }

    private static Preferences view(UserPreference preference) {
        return new Preferences(preference.getLocale(), preference.getTheme(), preference.getMotion(),
                preference.getThemeTransition());
    }
}
