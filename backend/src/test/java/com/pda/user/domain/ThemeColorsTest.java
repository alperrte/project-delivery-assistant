package com.pda.user.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class ThemeColorsTest {
    @Test
    void acceptsArbitraryColorsAndExpandsShortHexWithoutChangingTheTone() {
        assertEquals("#AABBCC", colors("#abc", 0).solidColor());
        assertEquals("#000000", colors("#000", 0).solidColor());
        assertEquals("#FFFFFF", colors("#fff", 360).solidColor());
        var random = new Random(42);
        for (int i = 0; i < 256; i++) {
            String hex = String.format("#%06x", random.nextInt(0x1000000));
            assertEquals(hex.toUpperCase(java.util.Locale.ROOT), colors(hex, i).solidColor());
        }
        var gradient = new ThemeColors("GRADIENT", "#123456", "#dedede", "#efefef", 360);
        assertEquals("#DEDEDE", gradient.gradientStartColor());
        assertEquals("#EFEFEF", gradient.gradientEndColor());
        assertEquals("GRADIENT", gradient.themeType());
        assertEquals(360, gradient.gradientAngle());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "red", "123456", "#ab", "#abcd", "#12345678", "#gggggg", " #abc", "#abc\n",
            "linear-gradient(red,blue)", "#123456;url(example.test)"})
    void rejectsInvalidOrNonOpaqueColorsInEverySlot(String color) {
        assertThrows(IllegalArgumentException.class, () -> colors(color, 90));
        assertThrows(IllegalArgumentException.class, () -> new ThemeColors("GRADIENT", "#000", color, "#fff", 90));
        assertThrows(IllegalArgumentException.class, () -> new ThemeColors("GRADIENT", "#000", "#fff", color, 90));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {-1, 361, Integer.MIN_VALUE, Integer.MAX_VALUE})
    void rejectsAnglesOutsideTheInclusiveRange(Integer angle) {
        assertThrows(IllegalArgumentException.class, () -> colors("#123456", angle));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "solid", "ANIMATED", "RAIN", "0"})
    void supportsOnlyPhaseOneTypes(String type) {
        assertThrows(IllegalArgumentException.class, () -> new ThemeColors(type, "#000", "#000", "#fff", 135));
    }

    private ThemeColors colors(String color, Integer angle) {
        return new ThemeColors("SOLID", color, "#000", "#fff", angle);
    }
}
