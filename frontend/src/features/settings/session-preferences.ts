"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { writeLocaleCookie } from "@/i18n/locale-cookie";
import { locales, type Locale } from "@/i18n/config";
import { switchLocale } from "@/i18n/routing";
import { setMotionPreference, setThemeTransitionPreference } from "@/lib/preferences/motion";
import { preferencesApi, preferencesKey, type ThemeChoice } from "./api";

/**
 * Two layers of interface choices:
 * - the SAVED defaults (Settings page, stored on the account): applied when a sign-in starts, so they come back after
 *   every logout and on every device;
 * - TEMPORARY changes (the language and theme switches in the navbar): they last for the current sign-in only. At
 *   sign-out the interface goes back to what the session started with.
 * The "baseline" is that starting point: the saved default, or what the browser had if nothing was ever saved.
 */
const BASELINE_KEY = "pda:session-baseline";

type Baseline = { userId: string; theme: ThemeChoice; locale: Locale };

function readBaseline(): Baseline | null {
  try {
    const raw = sessionStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as Baseline) : null;
  } catch {
    return null;
  }
}

export function writeBaseline(baseline: Baseline) {
  try {
    sessionStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
  } catch {
    // Storage unavailable: the saved defaults still apply at the next sign-in.
  }
}

function clearBaseline() {
  try {
    sessionStorage.removeItem(BASELINE_KEY);
  } catch {
    // nothing to clear
  }
}

/** The signed-in user's saved defaults; shared by the session start and the Settings page. */
export function useSavedPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: preferencesApi.get,
    enabled: !!userId,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function asThemeChoice(value: string | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Animation defaults stay in sync with the account, including reloads of sessions affected by old defaults.
 * Language/theme defaults apply once per session, preserving temporary navbar changes on later reloads.
 */
export function useApplySavedPreferences(userId: string | undefined) {
  const saved = useSavedPreferences(userId);
  const { theme, setTheme } = useTheme();
  const locale = useLocale() as Locale;

  useEffect(() => {
    if (!userId || !saved.data) return;
    const defaults = saved.data;
    setMotionPreference(defaults.motion ?? "on");
    setThemeTransitionPreference(defaults.themeTransition ?? true);
    if (readBaseline()?.userId === userId) return;
    writeBaseline({ userId, theme: defaults.theme ?? asThemeChoice(theme), locale: defaults.locale ?? locale });
    if (defaults.theme) setTheme(defaults.theme);
    if (defaults.locale && locales.includes(defaults.locale) && defaults.locale !== locale) {
      writeLocaleCookie(defaults.locale);
      window.location.replace(switchLocale(window.location.pathname, window.location.search, defaults.locale, window.location.hash));
    }
  }, [userId, saved.data, theme, setTheme, locale]);
}

/** Returns what the sign-in started with; call it when the person signs out or the session ends. */
export function useRestoreSessionBaseline() {
  const { setTheme } = useTheme();

  // Always rewrites the language cookie instead of comparing with the language on screen: this runs from long-lived
  // listeners, where "the language on screen" can be stale, and writing the same value again is harmless.
  return function restore() {
    const baseline = readBaseline();
    clearBaseline();
    if (!baseline) return;
    setTheme(baseline.theme);
    writeLocaleCookie(baseline.locale);
  };
}
