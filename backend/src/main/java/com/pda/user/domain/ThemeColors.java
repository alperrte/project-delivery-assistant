package com.pda.user.domain;

import java.util.Locale;

/** Opaque sRGB colors, independent of the existing light/dark/system appearance choice. */
public record ThemeColors(String themeType, String solidColor, String gradientStartColor,
                          String gradientEndColor, Integer gradientAngle) {
    public static final String HEX_PATTERN = "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})";
    public static final ThemeColors DEFAULT = new ThemeColors("SOLID", "#1B5FE0", "#1B5FE0", "#8B5CF6", 135);

    public ThemeColors {
        if (!"SOLID".equals(themeType) && !"GRADIENT".equals(themeType) && !"ANIMATED".equals(themeType)) {
            throw new IllegalArgumentException("Unsupported theme type");
        }
        solidColor = normalize(solidColor);
        gradientStartColor = normalize(gradientStartColor);
        gradientEndColor = normalize(gradientEndColor);
        if (gradientAngle == null || gradientAngle < 0 || gradientAngle > 360) {
            throw new IllegalArgumentException("Invalid gradient angle");
        }
    }

    private static String normalize(String value) {
        if (value == null || !value.matches(HEX_PATTERN)) {
            throw new IllegalArgumentException("Invalid theme color");
        }
        String hex = value.substring(1).toUpperCase(Locale.ROOT);
        if (hex.length() == 3) {
            hex = "" + hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        return "#" + hex;
    }
}
