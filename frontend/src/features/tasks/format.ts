"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dateFromKey } from "@/features/reminders/dates";
import { relativeTime } from "@/features/squads/relative-time";
import { countdown, splitMinutes } from "./deadline";

/** Locale aware text for the dates, durations and countdowns every task screen shows. */
export function useTaskFormat() {
  const locale = useLocale();
  const t = useTranslations("tasks.common");

  return useMemo(() => {
    const dateTime = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const dateTimeYear = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const dayYear = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
    const sameYear = (date: Date) => date.getFullYear() === new Date().getFullYear();

    return {
      /** `3 Eki 18:00`; the year only appears when it is not the current one. */
      dateTime: (iso: string) => {
        const value = new Date(iso);
        return (sameYear(value) ? dateTime : dateTimeYear).format(value);
      },
      /** A plain `YYYY-MM-DD` key as `3 Eki`. */
      day: (key: string) => {
        const value = dateFromKey(key);
        return (sameYear(value) ? day : dayYear).format(value);
      },
      weekday: (key: string) => weekday.format(dateFromKey(key)),
      /** `1s 30dk`, `45dk`, `2s`. */
      duration: (minutes: number) => {
        const { hours, minutes: rest } = splitMinutes(minutes);
        if (hours > 0 && rest > 0) return t("durationHm", { hours, minutes: rest });
        if (hours > 0) return t("durationH", { hours });
        return t("durationM", { minutes: rest });
      },
      /** `2 gün kaldı` / `3 saat gecikti`. */
      countdown: (iso: string) => {
        const { unit, value, past } = countdown(iso);
        return t(`countdown.${past ? "late" : "left"}.${unit}`, { value });
      },
      relative: (iso: string) => relativeTime(iso, locale),
    };
  }, [locale, t]);
}
