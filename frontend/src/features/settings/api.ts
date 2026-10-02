import { apiRequest } from "@/lib/api/client";
import type { Locale } from "@/i18n/config";
import type { MotionPreference } from "@/lib/preferences/motion";

export type ThemeChoice = "system" | "light" | "dark";

/** The interface choices a person has saved. A field is absent until they have saved once. */
export type SavedPreferences = {
  locale?: Locale;
  theme?: ThemeChoice;
  motion?: MotionPreference;
  themeTransition?: boolean;
};

/** Everything the Settings page saves in one go. */
export type PreferencesDraft = Required<SavedPreferences>;

export const preferencesKey = ["preferences"] as const;

export const preferencesApi = {
  get: () => apiRequest<SavedPreferences>("/users/me/preferences"),
  save: (body: PreferencesDraft) =>
    apiRequest<SavedPreferences>("/users/me/preferences", { method: "PUT", body }),
};
