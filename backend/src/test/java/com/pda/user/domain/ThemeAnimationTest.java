package com.pda.user.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class ThemeAnimationTest {
    @Test
    void defaultsAreSilentAndIndependentOfAppearanceAndMotion() {
        assertEquals(new ThemeAnimation("THUNDERSTORM", false, 50, true), ThemeAnimation.DEFAULT);
        for (String type : new String[]{"SOLID", "GRADIENT", "ANIMATED"}) {
            assertEquals(type, new ThemeColors(type, "#abc", "#123456", "#abcdef", 360).themeType());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"THUNDERSTORM", "RAIN", "SNOW", "WATER", "FIRE"})
    void supportsAllFivePresetsWithIndependentSoundAndAnimationToggles(String preset) {
        for (int volume : new int[]{0, 50, 100}) for (boolean sound : new boolean[]{false, true}) {
            var preference = new ThemeAnimation(preset, sound, volume, !sound);
            assertEquals(preset, preference.animation());
            assertEquals(sound, preference.soundEnabled());
            assertEquals(volume, preference.soundVolume());
            assertEquals(!sound, preference.animationEnabled());
        }
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "rain", "FOG", "SOLID", "0", "RAIN,SNOW", "WATER\n", " THUNDERSTORM"})
    void rejectsUnknownPresets(String preset) {
        assertThrows(IllegalArgumentException.class, () -> new ThemeAnimation(preset, false, 50, true));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {-1, 101, Integer.MIN_VALUE, Integer.MAX_VALUE})
    void rejectsInvalidVolumes(Integer volume) {
        assertThrows(IllegalArgumentException.class, () -> new ThemeAnimation("RAIN", true, volume, true));
    }
}
