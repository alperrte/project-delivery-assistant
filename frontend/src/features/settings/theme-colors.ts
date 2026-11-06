/** Account preference contract from phase 1. No browser storage: the account API owns persistence. */
export type ThemeColors = {
  themeType: "SOLID" | "GRADIENT" | "ANIMATED";
  solidColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
};

export const DEFAULT_THEME_COLORS: ThemeColors = {
  themeType: "SOLID", solidColor: "#1B5FE0", gradientStartColor: "#1B5FE0", gradientEndColor: "#8B5CF6", gradientAngle: 135,
};

export function normalizeHex(value: string): string | undefined {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return;
  const hex = value.slice(1).toUpperCase();
  return `#${hex.length === 3 ? [...hex].map(c => c + c).join("") : hex}`;
}

export function normalizeThemeColors(value: unknown): ThemeColors | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (v.themeType !== "SOLID" && v.themeType !== "GRADIENT" && v.themeType !== "ANIMATED") return;
  if (typeof v.gradientAngle !== "number" || !Number.isInteger(v.gradientAngle) || v.gradientAngle < 0 || v.gradientAngle > 360) return;
  const colors = [v.solidColor, v.gradientStartColor, v.gradientEndColor].map(c => typeof c === "string" ? normalizeHex(c) : undefined);
  if (colors.some(c => !c)) return;
  return { themeType: v.themeType, solidColor: colors[0]!, gradientStartColor: colors[1]!, gradientEndColor: colors[2]!, gradientAngle: v.gradientAngle };
}

export function sameThemeColors(a: ThemeColors, b: ThemeColors) {
  return a.themeType === b.themeType && a.gradientAngle === b.gradientAngle
    && ["solidColor", "gradientStartColor", "gradientEndColor"].every(key => {
      const field = key as "solidColor" | "gradientStartColor" | "gradientEndColor";
      return (normalizeHex(a[field]) ?? a[field]) === (normalizeHex(b[field]) ?? b[field]);
    });
}

function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function hex(rgb: number[]) { return `#${rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase(); }
export function luminance(color: string) {
  const values = rgb(color).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

/** Adjust UI accents, never the stored user's colors. Text accents reach 4.5:1 on the workspace surface. */
function accessible(color: string, surface: string) {
  const toward = luminance(surface) > .5 ? 0 : 255;
  const source = rgb(color);
  for (let step = 0; step <= 100; step++) {
    const candidate = hex(source.map(c => c + (toward - c) * step / 100));
    if (contrast(candidate, surface) >= 4.6) return candidate;
  }
  return toward === 0 ? "#000000" : "#FFFFFF";
}

export function themePalette(colors: ThemeColors, dark: boolean): Record<string, string> {
  const primary = accessible(colors.themeType === "GRADIENT" ? colors.gradientStartColor : colors.solidColor, dark ? "#18191B" : "#FFFFFF");
  const foreground = contrast(primary, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#000000";
  // Both endpoints have >=4.6:1 against white; sRGB interpolation cannot exceed their maximum luminance.
  const paint = colors.themeType === "GRADIENT"
    ? `linear-gradient(${colors.gradientAngle}deg, ${accessible(colors.gradientStartColor, "#FFFFFF")}, ${accessible(colors.gradientEndColor, "#FFFFFF")})`
    : "none";
  return { "--primary": primary, "--primary-hover": primary, "--primary-foreground": foreground, "--ring": primary,
    "--theme-action-paint": paint, "--theme-action-foreground": colors.themeType === "GRADIENT" ? "#FFFFFF" : foreground };
}

export function themeSwatch(colors: ThemeColors) {
  return colors.themeType !== "GRADIENT" ? colors.solidColor
    : `linear-gradient(${colors.gradientAngle}deg, ${colors.gradientStartColor}, ${colors.gradientEndColor})`;
}

export function clearWorkspaceTheme() {
  document.documentElement.removeAttribute("data-user-theme");
  for (const mode of ["light", "dark"]) for (const key of Object.keys(themePalette(DEFAULT_THEME_COLORS, false))) {
    document.documentElement.style.removeProperty(`--user-${mode}-${key.slice(2)}`);
  }
}

export function applyWorkspaceTheme(colors: ThemeColors) {
  const safe = normalizeThemeColors(colors);
  if (!safe) return clearWorkspaceTheme();
  for (const [mode, dark] of [["light", false], ["dark", true]] as const) {
    for (const [key, value] of Object.entries(themePalette(safe, dark))) document.documentElement.style.setProperty(`--user-${mode}-${key.slice(2)}`, value);
  }
  document.documentElement.setAttribute("data-user-theme", safe.themeType.toLowerCase());
}
