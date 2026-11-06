/** Account preference contract from phase 1. No browser storage: the account API owns persistence. */
export type ThemeColors = {
  themeType: "SOLID" | "GRADIENT" | "ANIMATED" | "ANIMATED_GRADIENT";
  solidColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
};

export function hasAnimatedBackground(type: ThemeColors["themeType"] | undefined) {
  return type === "ANIMATED" || type === "ANIMATED_GRADIENT";
}

export function isGradientTheme(type: ThemeColors["themeType"] | undefined) {
  return type === "GRADIENT" || type === "ANIMATED_GRADIENT";
}

export function combineThemeType(color: "SOLID" | "GRADIENT", animated: boolean): ThemeColors["themeType"] {
  return animated ? (color === "GRADIENT" ? "ANIMATED_GRADIENT" : "ANIMATED") : color;
}

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
  if (v.themeType !== "SOLID" && v.themeType !== "GRADIENT" && v.themeType !== "ANIMATED" && v.themeType !== "ANIMATED_GRADIENT") return;
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
function accessible(color: string, surface: string | string[]) {
  const surfaces = typeof surface === "string" ? [surface] : surface;
  const toward = luminance(surfaces[0]) > .5 ? 0 : 255;
  const source = rgb(color);
  for (let step = 0; step <= 100; step++) {
    const candidate = hex(source.map(c => c + (toward - c) * step / 100));
    if (surfaces.every(background => contrast(candidate, background) >= 4.6)) return candidate;
  }
  return toward === 0 ? "#000000" : "#FFFFFF";
}

function mix(base: string, color: string, amount: number) {
  const target = rgb(color);
  return hex(rgb(base).map((channel, i) => channel * (1 - amount) + target[i] * amount));
}

/** Appearance-aware surfaces; both gradient endpoints remain visible without tinting semantic status colors. */
function workspaceSurfaces(colors: ThemeColors, dark: boolean) {
  const gradient = isGradientTheme(colors.themeType);
  const start = gradient ? colors.gradientStartColor : colors.solidColor;
  const end = gradient ? colors.gradientEndColor : start;
  const middle = hex(rgb(start).map((channel, i) => (channel + rgb(end)[i]) / 2));
  const background = [start, end].map(color => mix(dark ? "#090A0B" : "#FFFFFF", color, .22));
  const sidebar = [start, end].map(color => mix(dark ? "#111214" : "#F9FAFA", color, .14));
  const hover = [start, end].map(color => mix(dark ? "#222326" : "#EAEBED", color, .24));
  const card = mix(dark ? "#18191B" : "#FFFFFF", middle, .055);
  const surfaces = [dark ? "#18191B" : "#FFFFFF", card];
  // A mixed gradient can have a darker midpoint than either endpoint. Check its full interpolation.
  for (const pair of [background, sidebar, hover]) for (let i = 0; i <= 20; i++) surfaces.push(mix(pair[0], pair[1], i / 20));
  const paint = (pair: string[]) => gradient ? `linear-gradient(${colors.gradientAngle}deg in srgb, ${pair[0]}, ${pair[1]})` : "none";
  return { surfaces, variables: {
    "--theme-surface-background": mix(background[0], background[1], .5),
    "--theme-surface-sidebar": mix(sidebar[0], sidebar[1], .5),
    "--theme-surface-card": card,
    "--theme-surface-hover": mix(hover[0], hover[1], .5),
    "--theme-surface-border": mix(dark ? "#27282B" : "#E5E7EB", middle, .14),
    "--theme-surface-input": mix(dark ? "#45474A" : "#C5C6C9", middle, .14),
    "--theme-surface-muted-foreground": accessible(dark ? "#A1A1AA" : "#525866", surfaces),
    "--theme-workspace-paint": paint(background), "--theme-sidebar-paint": paint(sidebar), "--theme-hover-paint": paint(hover),
  } };
}

export function themePalette(colors: ThemeColors, dark: boolean): Record<string, string> {
  const surface = dark ? "#18191B" : "#FFFFFF";
  const workspace = workspaceSurfaces(colors, dark);
  const accentSurfaces = hasAnimatedBackground(colors.themeType) ? [surface] : workspace.surfaces;
  let start = accessible(isGradientTheme(colors.themeType) ? colors.gradientStartColor : colors.solidColor, accentSurfaces);
  let end = accessible(isGradientTheme(colors.themeType) ? colors.gradientEndColor : colors.solidColor, accentSurfaces);
  if (isGradientTheme(colors.themeType) && dark) {
    // Light endpoints can have a darker midpoint. Protect the whole sRGB interpolation too.
    const from = rgb(start), to = rgb(end);
    for (let step = 0; step <= 100; step++) {
      start = hex(from.map(c => c + (255 - c) * step / 100));
      end = hex(to.map(c => c + (255 - c) * step / 100));
      if (Array.from({ length: 21 }, (_, i) => hex(rgb(start).map((c, j) => c + (rgb(end)[j] - c) * i / 20))).every(c => accentSurfaces.every(background => contrast(c, background) >= 4.7))) break;
    }
  }
  // Native controls need a solid color: derive it from BOTH gradient endpoints.
  const primary = isGradientTheme(colors.themeType) ? accessible(hex(rgb(start).map((c, i) => (c + rgb(end)[i]) / 2)), accentSurfaces) : start;
  const foreground = contrast(primary, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#000000";
  // Both endpoints have >=4.6:1 against white; sRGB interpolation cannot exceed their maximum luminance.
  const paint = isGradientTheme(colors.themeType)
    ? `linear-gradient(${colors.gradientAngle}deg, ${accessible(colors.gradientStartColor, "#FFFFFF")}, ${accessible(colors.gradientEndColor, "#FFFFFF")})`
    : "none";
  return { ...workspace.variables, "--primary": primary, "--primary-hover": primary, "--primary-foreground": foreground, "--ring": isGradientTheme(colors.themeType) ? end : primary,
    "--theme-accent-start": start, "--theme-accent-end": end,
    "--theme-accent-paint": isGradientTheme(colors.themeType) ? `linear-gradient(${colors.gradientAngle}deg in srgb, ${start}, ${end})` : "none",
    "--theme-soft-paint": isGradientTheme(colors.themeType) ? `linear-gradient(${colors.gradientAngle}deg, ${start}14, ${end}14)` : "none",
    "--theme-action-paint": paint, "--theme-action-foreground": isGradientTheme(colors.themeType) ? "#FFFFFF" : foreground };
}

export function themeSwatch(colors: ThemeColors) {
  return !isGradientTheme(colors.themeType) ? colors.solidColor
    : `linear-gradient(${colors.gradientAngle}deg, ${colors.gradientStartColor}, ${colors.gradientEndColor})`;
}

export function clearWorkspaceTheme() {
  document.documentElement.removeAttribute("data-user-theme");
  document.documentElement.removeAttribute("data-user-background");
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
  document.documentElement.setAttribute("data-user-theme", isGradientTheme(safe.themeType) ? "gradient" : "solid");
  if (hasAnimatedBackground(safe.themeType)) document.documentElement.setAttribute("data-user-background", "animated");
  else document.documentElement.removeAttribute("data-user-background");
}
