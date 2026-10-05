import { apiRequest } from "@/lib/api/client";
import type { Locale } from "@/i18n/config";
import { normalizeMotionPreference, type MotionPreference } from "@/lib/preferences/motion";

export type ThemeChoice = "system" | "light" | "dark";

/** Saved interface choices. Animation choices resolve to enabled defaults; language/theme may be absent. */
export type SavedPreferences = {
  locale?: Locale;
  theme?: ThemeChoice;
  motion?: MotionPreference;
  themeTransition?: boolean;
};

/** Everything the Settings page saves in one go. */
export type PreferencesDraft = Required<SavedPreferences>;

export const preferencesKey = ["preferences"] as const;

// The API sends null for choices the account has never saved.
type PreferencesResponse = {
  locale?: Locale | null;
  theme?: ThemeChoice | null;
  motion?: MotionPreference | "system" | null;
  themeTransition?: boolean | null;
};

function normalizePreferences(response: PreferencesResponse): SavedPreferences {
  return {
    ...(response.locale != null ? { locale: response.locale } : {}),
    ...(response.theme != null ? { theme: response.theme } : {}),
    motion: normalizeMotionPreference(response.motion),
    themeTransition: response.themeTransition ?? true,
  };
}

export const preferencesApi = {
  get: async () => normalizePreferences(await apiRequest<PreferencesResponse>("/users/me/preferences")),
  save: async (body: PreferencesDraft) =>
    normalizePreferences(await apiRequest<PreferencesResponse>("/users/me/preferences", { method: "PUT", body })),
};
