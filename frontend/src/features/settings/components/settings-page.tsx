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
import { useLocaleSelection } from "@/components/layout/locale-switcher";
import { errorKey } from "@/lib/api/error-message";
import { locales, type Locale } from "@/i18n/config";
import {
  setMotionPreference,
  setThemeTransitionPreference,
  useMotionPreference,
  useThemeTransitionPreference,
} from "@/lib/preferences/motion";
import { preferencesApi, preferencesKey, type PreferencesDraft, type SavedPreferences, type ThemeChoice } from "../api";
import { useSavedPreferences, writeBaseline } from "../session-preferences";
import { AppearanceSection } from "./appearance-section";
import { LanguageSection } from "./language-section";
import { MotionSection } from "./motion-section";

const same = (a: PreferencesDraft, b: PreferencesDraft) =>
  a.locale === b.locale && a.theme === b.theme && a.motion === b.motion && a.themeTransition === b.themeTransition;

/**
 * The interface defaults (language, theme, animations); the account and the password are on the account page. They are edited as a draft: nothing changes on screen while
 * choosing, and Kaydet stores them on the account, where they apply at every sign-in. The language and theme switches
 * in the navbar are separate and only last for the current sign-in.
 */
export function SettingsPage() {
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
  const [draft, setDraft] = useState<PreferencesDraft | null>(null);

  // What is saved, or, for somebody who never saved, what the interface has right now.
  const stored: SavedPreferences | undefined = saved.data;
  const initial: PreferencesDraft = {
    locale: stored?.locale ?? locale,
    theme: stored?.theme ?? ((theme === "light" || theme === "dark" ? theme : "system") as ThemeChoice),
    motion: stored?.motion ?? motion,
    themeTransition: stored?.themeTransition ?? themeTransition,
  };
  const current = draft ?? initial;
  const dirty = draft !== null && !same(draft, initial);

  const save = useMutation({
    mutationFn: (values: PreferencesDraft) => preferencesApi.save(values),
    onSuccess: (result, values) => {
      queryClient.setQueryData(preferencesKey, result);
      setDraft(null);
      // They are the defaults now, and what the navbar's temporary changes return to at sign-out.
      if (user) writeBaseline({ userId: user.id, theme: values.theme, locale: values.locale });
      setMotionPreference(values.motion);
      setThemeTransitionPreference(values.themeTransition);
      setTheme(values.theme);
      if (locales.includes(values.locale)) applyLocale(values.locale);
      toast.success(t("save.done"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <PageContainer width="form">
      <PageHeader title={t("title")} description={t("description")} />
      {!user || saved.isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <>
          <LanguageSection value={current.locale} onChange={(next) => setDraft({ ...current, locale: next })} />
          <AppearanceSection value={current.theme} onChange={(next) => setDraft({ ...current, theme: next })} />
          <MotionSection
            motion={current.motion}
            themeTransition={current.themeTransition}
            onMotionChange={(next) => setDraft({ ...current, motion: next })}
            onThemeTransitionChange={(next) => setDraft({ ...current, themeTransition: next })}
          />

          <div data-sticky-actions className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 sm:-mb-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm text-muted-foreground">{dirty ? t("save.unsaved") : t("save.clean")}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setDraft(null)}>
                  {t("save.discard")}
                </Button>
                <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate(current)}>
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
