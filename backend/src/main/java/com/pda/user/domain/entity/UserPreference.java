package com.pda.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A user's saved interface defaults: language, theme, how much the interface may move and whether the theme change
 * is animated. They follow the user to every device and every sign-in.
 */
@Entity
@Table(name = "user_preferences")
public class UserPreference {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(length = 8)
    private String locale;

    @Column(length = 8)
    private String theme;

    @Column(length = 8)
    private String motion;

    @Column(name = "theme_transition")
    private Boolean themeTransition;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserPreference() {
    }

    public static UserPreference of(UUID userId, String locale, String theme, String motion, boolean themeTransition,
                                    Instant at) {
        UserPreference preference = new UserPreference();
        preference.userId = Objects.requireNonNull(userId, "userId is required");
        preference.replace(locale, theme, motion, themeTransition, at);
        return preference;
    }

    public void replace(String locale, String theme, String motion, boolean themeTransition, Instant at) {
        this.locale = Objects.requireNonNull(locale, "locale is required");
        this.theme = Objects.requireNonNull(theme, "theme is required");
        this.motion = Objects.requireNonNull(motion, "motion is required");
        this.themeTransition = themeTransition;
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }

    public UUID getUserId() { return userId; }
    public String getLocale() { return locale; }
    public String getTheme() { return theme; }
    public String getMotion() { return motion; }
    public Boolean getThemeTransition() { return themeTransition; }
    public Instant getUpdatedAt() { return updatedAt; }
}
