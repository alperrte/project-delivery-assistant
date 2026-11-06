import { test, expect } from "@playwright/test";
import { DEFAULT_THEME_COLORS, normalizeThemeColors, normalizeHex, contrast, themePalette, sameThemeColors } from "../src/features/settings/theme-colors";

test("normalizes arbitrary HEX and rejects incomplete, injectable and out-of-range values", () => {
  expect(normalizeHex("#abc")).toBe("#AABBCC");
  for (const bad of ["red", "#abcd", "#12345678", "#123;url(x)", " #abc"]) expect(normalizeHex(bad)).toBeUndefined();
  for (const value of [null, {}, { ...DEFAULT_THEME_COLORS, themeType: "UNKNOWN" },
    { ...DEFAULT_THEME_COLORS, gradientAngle: -1 }, { ...DEFAULT_THEME_COLORS, gradientAngle: 361 },
    { ...DEFAULT_THEME_COLORS, gradientAngle: 12.5 }, { ...DEFAULT_THEME_COLORS, solidColor: "url(x)" }]) {
    expect(normalizeThemeColors(value)).toBeUndefined();
  }
  expect(sameThemeColors({ ...DEFAULT_THEME_COLORS, solidColor: "#ABC" }, { ...DEFAULT_THEME_COLORS, solidColor: "#aabbcc" })).toBe(true);
});

test("light/dark semantic accents and gradient stops preserve text contrast even for black and white", () => {
  for (const dark of [false, true]) for (let i = 0; i < 256; i++) {
    const color = `#${i.toString(16).padStart(2, "0").repeat(3)}`;
    const palette = themePalette({ ...DEFAULT_THEME_COLORS, solidColor: color }, dark);
    expect(contrast(palette["--primary"], dark ? "#18191B" : "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette["--primary"], palette["--primary-foreground"])).toBeGreaterThanOrEqual(4.5);
    const gradient = themePalette({ ...DEFAULT_THEME_COLORS, themeType: "GRADIENT", gradientStartColor: color, gradientEndColor: "#FFFFFF" }, dark);
    for (const stop of gradient["--theme-action-paint"].match(/#[0-9A-F]{6}/g)!) expect(contrast(stop, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  }
});
