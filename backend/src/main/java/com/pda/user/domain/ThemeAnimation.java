package com.pda.user.domain;

import java.util.Set;

/** Account-owned preferences only. Rendering, reduced motion and audio playback belong to the client. */
public record ThemeAnimation(String animation, boolean soundEnabled, Integer soundVolume, boolean animationEnabled) {
    public static final Set<String> ANIMATIONS = Set.of("THUNDERSTORM", "RAIN", "SNOW", "WATER", "FIRE");
    public static final ThemeAnimation DEFAULT = new ThemeAnimation("THUNDERSTORM", false, 50, true);

    public ThemeAnimation {
        if (animation == null || !ANIMATIONS.contains(animation)) {
            throw new IllegalArgumentException("Unsupported theme animation");
        }
        if (soundVolume == null || soundVolume < 0 || soundVolume > 100) {
            throw new IllegalArgumentException("Invalid theme sound volume");
        }
    }
}
