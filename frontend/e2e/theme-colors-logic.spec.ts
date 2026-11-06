import { test, expect } from "@playwright/test";
import { DEFAULT_THEME_COLORS, normalizeThemeColors, normalizeHex, contrast, themePalette, sameThemeColors, combineThemeType, hasAnimatedBackground, isGradientTheme } from "../src/features/settings/theme-colors";

test("color and background choices round-trip all four account types and share their surface source colors", () => {
  for (const color of ["SOLID", "GRADIENT"] as const) for (const animated of [false, true]) {
    const type = combineThemeType(color, animated);
    expect(hasAnimatedBackground(type)).toBe(animated);
    expect(isGradientTheme(type)).toBe(color === "GRADIENT");
    const stored = { ...DEFAULT_THEME_COLORS, themeType: type };
    expect(normalizeThemeColors(stored)).toEqual(stored);
    for (const dark of [false, true]) {
      const palette = themePalette(stored, dark), staticPalette = themePalette({ ...stored, themeType: color }, dark);
      for (const key of Object.keys(palette).filter(k => k.startsWith("--theme-surface-") || ["--theme-workspace-paint", "--theme-sidebar-paint", "--theme-hover-paint"].includes(k))) expect(palette[key]).toBe(staticPalette[key]);
    }
  }
  expect(combineThemeType("SOLID", true)).toBe("ANIMATED"); // Legacy account preferences keep their meaning.
  expect(combineThemeType("GRADIENT", true)).toBe("ANIMATED_GRADIENT");
});

test("static surface endpoints and gradient interiors retain readable primary and muted text for extreme colors", () => {
  for (const dark of [false, true]) for (const start of ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"]) for (const end of ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"]) {
    const palette = themePalette({ ...DEFAULT_THEME_COLORS, themeType: "GRADIENT", gradientStartColor: start, gradientEndColor: end }, dark);
    const backgrounds = [palette["--theme-surface-card"]];
    for (const key of ["--theme-workspace-paint", "--theme-sidebar-paint", "--theme-hover-paint"]) {
      const [a, b] = palette[key].match(/#[0-9A-F]{6}/g)!;
      for (let i = 0; i <= 20; i++) backgrounds.push(`#${[1, 3, 5].map(offset => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - i / 20) + parseInt(b.slice(offset, offset + 2), 16) * i / 20).toString(16).padStart(2, "0")).join("")}`);
    }
    for (const background of backgrounds) for (const key of ["--primary", "--ring", "--theme-surface-muted-foreground"]) expect(contrast(palette[key], background)).toBeGreaterThanOrEqual(4.5);
  }
});

test("both gradient colors affect native fallback and all sampled accent tones retain contrast", () => {
  for (const dark of [false, true]) {
    const first = themePalette({ ...DEFAULT_THEME_COLORS, themeType: "GRADIENT", gradientEndColor: "#00CC44" }, dark);
    const second = themePalette({ ...DEFAULT_THEME_COLORS, themeType: "GRADIENT", gradientEndColor: "#E03060" }, dark);
    expect(first["--primary"]).not.toBe(second["--primary"]);
    for (const [start, end] of [["#FF0000", "#00FF00"], ["#000000", "#FFFFFF"], ["#FFFF00", "#0000FF"], ["#1B5FE0", "#8B5CF6"]]) {
      const p = themePalette({ ...DEFAULT_THEME_COLORS, themeType: "GRADIENT", gradientStartColor: start, gradientEndColor: end }, dark);
      const a = p["--theme-accent-start"], b = p["--theme-accent-end"];
      for (let i = 0; i <= 100; i++) {
        const mixed = `#${[1, 3, 5].map(offset => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - i / 100) + parseInt(b.slice(offset, offset + 2), 16) * i / 100).toString(16).padStart(2, "0")).join("")}`;
        expect(contrast(mixed, dark ? "#18191B" : "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

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
