import { apiRequest } from "@/lib/api/client";
import type { Locale } from "@/i18n/config";
import { normalizeMotionPreference, type MotionPreference } from "@/lib/preferences/motion";
import { DEFAULT_THEME_COLORS, normalizeThemeColors, type ThemeColors } from "./theme-colors";

export type ThemeChoice = "system" | "light" | "dark";
export type NavbarMode = "always-visible" | "auto-hide";

/** Saved interface choices. Animation choices resolve to enabled defaults; language/theme may be absent. */
export type SavedPreferences = {
  themeColors: ThemeColors;
  locale?: Locale;
  theme?: ThemeChoice;
  motion?: MotionPreference;
  themeTransition?: boolean;
  languageTransition?: boolean;
  navbarMode?: NavbarMode;
};

/** Everything the Settings page saves in one go. */
export type PreferencesDraft = Required<SavedPreferences>;

export const preferencesKey = ["preferences"] as const;
export const savedPreferencesKey = (userId: string | undefined) => [...preferencesKey, userId] as const;

// The API sends null for choices the account has never saved.
type PreferencesResponse = {
  themeColors?: unknown;
  locale?: Locale | null;
  theme?: ThemeChoice | null;
  motion?: MotionPreference | "system" | null;
  themeTransition?: boolean | null;
  languageTransition?: boolean | null;
  navbarMode?: NavbarMode | null;
};

function normalizePreferences(response: PreferencesResponse): SavedPreferences {
  return {
    themeColors: normalizeThemeColors(response.themeColors) ?? DEFAULT_THEME_COLORS,
    ...(response.locale != null ? { locale: response.locale } : {}),
    ...(response.theme != null ? { theme: response.theme } : {}),
    motion: normalizeMotionPreference(response.motion),
    themeTransition: response.themeTransition ?? true,
    languageTransition: response.languageTransition ?? true,
    ...(response.navbarMode != null ? { navbarMode: response.navbarMode } : {}),
  };
}

export const preferencesApi = {
  get: async (signal?: AbortSignal) => normalizePreferences(await apiRequest<PreferencesResponse>("/users/me/preferences", { signal })),
  save: async (body: PreferencesDraft) =>
    normalizePreferences(await apiRequest<PreferencesResponse>("/users/me/preferences", { method: "PUT", body })),
  resetTheme: async () => normalizePreferences(await apiRequest<PreferencesResponse>("/users/me/preferences/theme", { method: "DELETE" })),
};
