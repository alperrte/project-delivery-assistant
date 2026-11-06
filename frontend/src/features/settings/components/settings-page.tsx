"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import type { AuthenticatedUser } from "@/features/auth/api";
import { useLocaleSelection } from "@/components/layout/locale-switcher";
import { errorKey } from "@/lib/api/error-message";
import { locales, type Locale } from "@/i18n/config";
import {
  setMotionPreference,
  setThemeTransitionPreference,
  setLanguageTransitionPreference,
  useMotionPreference,
  useThemeTransitionPreference,
  useLanguageTransitionPreference,
} from "@/lib/preferences/motion";
import { preferencesApi, savedPreferencesKey, type PreferencesDraft, type SavedPreferences, type ThemeChoice } from "../api";
import { useSavedPreferences, writeBaseline } from "../session-preferences";
import { AppearanceSection } from "./appearance-section";
import { LanguageSection } from "./language-section";
import { MotionSection } from "./motion-section";
import { NavigationSection } from "./navigation-section";
import { useNavbarAutoHideEnabled } from "@/components/layout/use-auto-hide";
import { DEFAULT_THEME_COLORS, normalizeThemeColors, sameThemeColors } from "../theme-colors";
import { ThemeColorsSection } from "./theme-colors-section";
import { DEFAULT_THEME_ANIMATION, normalizeThemeAnimation, sameThemeAnimation } from "../theme-animation";

const same = (a: PreferencesDraft, b: PreferencesDraft) =>
  a.locale === b.locale && a.theme === b.theme && a.motion === b.motion && a.themeTransition === b.themeTransition
  && a.languageTransition === b.languageTransition && a.navbarMode === b.navbarMode && sameThemeColors(a.themeColors, b.themeColors) && sameThemeAnimation(a.themeAnimation, b.themeAnimation);

/**
 * Interface defaults are edited as a draft; only the local color preview changes before Save.
 * Save stores them on the account, where they apply at every sign-in. The language and theme switches
 * in the navbar are separate and only last for the current sign-in.
 */
export function SettingsPage() {
  const { data: user } = useSession();
  return <SettingsEditor key={user?.id ?? "anonymous"} />;
}

function SettingsEditor() {
  const t = useTranslations("preferences");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const saved = useSavedPreferences(user?.id);
  const { theme, setTheme } = useTheme();
  const locale = useLocale() as Locale;
  const { select: applyLocale, overlay } = useLocaleSelection();
  const [motion] = useMotionPreference();
  const [themeTransition] = useThemeTransitionPreference();
  const [languageTransition] = useLanguageTransitionPreference();
  const [draft, setDraft] = useState<PreferencesDraft | null>(null);

  // What is saved, or, for somebody who never saved, what the interface has right now.
  const stored: SavedPreferences | undefined = saved.data;
  const autoHide = useNavbarAutoHideEnabled(stored?.navbarMode);
  const initial: PreferencesDraft = {
    themeColors: stored?.themeColors ?? DEFAULT_THEME_COLORS,
    themeAnimation: stored?.themeAnimation ?? DEFAULT_THEME_ANIMATION,
    locale: stored?.locale ?? locale,
    theme: stored?.theme ?? ((theme === "light" || theme === "dark" ? theme : "system") as ThemeChoice),
    motion: stored?.motion ?? motion,
    themeTransition: stored?.themeTransition ?? themeTransition,
    languageTransition: stored?.languageTransition ?? languageTransition,
    navbarMode: stored?.navbarMode ?? (autoHide ? "auto-hide" : "always-visible"),
  };
  const current = draft ?? initial;
  const dirty = draft !== null && !same(draft, initial);
  const actorId = user?.id;
  const isCurrentActor = () => !!actorId && queryClient.getQueryData<AuthenticatedUser>(sessionQueryKey)?.id === actorId;

  const save = useMutation({
    mutationFn: (values: PreferencesDraft) => preferencesApi.save(values),
    onSuccess: (result, values) => {
      if (!isCurrentActor()) return;
      queryClient.setQueryData(savedPreferencesKey(actorId), result);
      setDraft(null);
      // They are the defaults now, and what the navbar's temporary changes return to at sign-out.
      if (user) writeBaseline({ userId: user.id, theme: values.theme, locale: values.locale });
      setMotionPreference(values.motion);
      setThemeTransitionPreference(values.themeTransition);
      setLanguageTransitionPreference(values.languageTransition);
      setTheme(values.theme);
      if (locales.includes(values.locale)) applyLocale(values.locale);
      toast.success(t("save.done"));
    },
    onError: (err) => { if (isCurrentActor()) toast.error(te(errorKey(err))); },
  });

  const reset = useMutation({
    mutationFn: preferencesApi.resetTheme,
    onSuccess: result => {
      if (!isCurrentActor()) return;
      queryClient.setQueryData(savedPreferencesKey(actorId), result);
      setDraft(previous => previous ? { ...previous, themeColors: result.themeColors, themeAnimation: result.themeAnimation } : null);
      toast.success(t("colors.resetDone"));
    },
    onError: err => { if (isCurrentActor()) toast.error(te(errorKey(err))); },
  });
  const busy = save.isPending || reset.isPending;
  const validColors = normalizeThemeColors(current.themeColors);
  const validAnimation = normalizeThemeAnimation(current.themeAnimation);

  return (
    <PageContainer width="form">
      <PageHeader title={t("title")} description={t("description")} />
      {!user || saved.isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : saved.isError && !saved.data ? (
        <div role="alert" className="space-y-3 rounded-lg border p-5">
          <p>{t("colors.loadError")}</p>
          <Button variant="outline" onClick={() => void saved.refetch()}>{t("colors.retry")}</Button>
        </div>
      ) : (
        <>
          <fieldset disabled={busy} className="min-w-0">
          <LanguageSection value={current.locale} onChange={(next) => setDraft({ ...current, locale: next })} />
          <AppearanceSection value={current.theme} onChange={(next) => setDraft({ ...current, theme: next })} />
          <ThemeColorsSection value={current.themeColors} fallback={initial.themeColors} appearance={current.theme}
            animation={current.themeAnimation} onAnimationChange={themeAnimation => setDraft({ ...current, themeAnimation })}
            onChange={themeColors => setDraft({ ...current, themeColors })} onReset={() => reset.mutate()} resetting={reset.isPending} />
          <NavigationSection value={current.navbarMode} onChange={(next) => setDraft({ ...current, navbarMode: next })} />
          <MotionSection
            motion={current.motion}
            themeTransition={current.themeTransition}
            languageTransition={current.languageTransition}
            onMotionChange={(next) => setDraft({ ...current, motion: next })}
            onThemeTransitionChange={(next) => setDraft({ ...current, themeTransition: next })}
            onLanguageTransitionChange={(next) => setDraft({ ...current, languageTransition: next })}
          />
          </fieldset>

          <div data-sticky-actions className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 sm:-mb-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm text-muted-foreground">{dirty ? t("save.unsaved") : t("save.clean")}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" disabled={!dirty || busy} onClick={() => setDraft(null)}>
                  {t("save.discard")}
                </Button>
                <Button type="button" disabled={!dirty || busy || !validColors || !validAnimation} onClick={() => { if (validColors && validAnimation) save.mutate({ ...current, themeColors: validColors, themeAnimation: validAnimation }); }}>
                  {save.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                  {t("save.save")}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      {overlay}
    </PageContainer>
  );
}
