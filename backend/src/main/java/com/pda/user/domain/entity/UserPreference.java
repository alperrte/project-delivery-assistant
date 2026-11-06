package com.pda.user.domain.entity;

import com.pda.user.domain.ThemeColors;
import com.pda.user.domain.ThemeAnimation;
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

    @Column(name = "language_transition")
    private Boolean languageTransition;

    /** Null retains the device defaults until the user explicitly saves a choice. */
    @Column(name = "navbar_mode", length = 16)
    private String navbarMode;

    @Column(name = "theme_type", nullable = false, length = 8)
    private String themeType = ThemeColors.DEFAULT.themeType();

    @Column(name = "solid_color", nullable = false, length = 7)
    private String solidColor = ThemeColors.DEFAULT.solidColor();

    @Column(name = "gradient_start_color", nullable = false, length = 7)
    private String gradientStartColor = ThemeColors.DEFAULT.gradientStartColor();

    @Column(name = "gradient_end_color", nullable = false, length = 7)
    private String gradientEndColor = ThemeColors.DEFAULT.gradientEndColor();

    @Column(name = "gradient_angle", nullable = false)
    private Integer gradientAngle = ThemeColors.DEFAULT.gradientAngle();

    @Column(name = "animation_preset", nullable = false, length = 16)
    private String animationPreset = ThemeAnimation.DEFAULT.animation();

    @Column(name = "theme_sound_enabled", nullable = false)
    private boolean themeSoundEnabled = ThemeAnimation.DEFAULT.soundEnabled();

    @Column(name = "theme_sound_volume", nullable = false)
    private Integer themeSoundVolume = ThemeAnimation.DEFAULT.soundVolume();

    @Column(name = "theme_animation_enabled", nullable = false)
    private boolean themeAnimationEnabled = ThemeAnimation.DEFAULT.animationEnabled();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserPreference() {
    }

    public static UserPreference of(UUID userId, String locale, String theme, String motion, boolean themeTransition,
                                    boolean languageTransition, Instant at) {
        UserPreference preference = new UserPreference();
        preference.userId = Objects.requireNonNull(userId, "userId is required");
        preference.replace(locale, theme, motion, themeTransition, languageTransition, at);
        return preference;
    }

    public void replace(String locale, String theme, String motion, boolean themeTransition,
                        boolean languageTransition, Instant at) {
        this.locale = Objects.requireNonNull(locale, "locale is required");
        this.theme = Objects.requireNonNull(theme, "theme is required");
        this.motion = Objects.requireNonNull(motion, "motion is required");
        this.themeTransition = themeTransition;
        this.languageTransition = languageTransition;
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }

    public UUID getUserId() { return userId; }
    public String getLocale() { return locale; }
    public String getTheme() { return theme; }
    public String getMotion() { return motion; }
    public Boolean getThemeTransition() { return themeTransition; }
    public Boolean getLanguageTransition() { return languageTransition; }
    public String getNavbarMode() { return navbarMode; }
    public void setNavbarMode(String navbarMode) { this.navbarMode = Objects.requireNonNull(navbarMode); }
    public Instant getUpdatedAt() { return updatedAt; }

    public ThemeColors getThemeColors() {
        return new ThemeColors(themeType, solidColor, gradientStartColor, gradientEndColor, gradientAngle);
    }

    public void setThemeColors(ThemeColors colors, Instant at) {
        Objects.requireNonNull(colors, "colors is required");
        this.themeType = colors.themeType();
        this.solidColor = colors.solidColor();
        this.gradientStartColor = colors.gradientStartColor();
        this.gradientEndColor = colors.gradientEndColor();
        this.gradientAngle = colors.gradientAngle();
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }

    public ThemeAnimation getThemeAnimation() {
        return new ThemeAnimation(animationPreset, themeSoundEnabled, themeSoundVolume, themeAnimationEnabled);
    }

    public void setThemeAnimation(ThemeAnimation animation, Instant at) {
        Objects.requireNonNull(animation, "animation is required");
        this.animationPreset = animation.animation();
        this.themeSoundEnabled = animation.soundEnabled();
        this.themeSoundVolume = animation.soundVolume();
        this.themeAnimationEnabled = animation.animationEnabled();
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }
}
