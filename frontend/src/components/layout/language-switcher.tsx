"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import TR from "country-flag-icons/react/3x2/TR";
import GB from "country-flag-icons/react/3x2/GB";
import DE from "country-flag-icons/react/3x2/DE";
import { locales, type Locale } from "@/i18n/config";
import { writeLocaleCookie } from "@/i18n/locale-cookie";
import { cn } from "@/lib/utils";

const FLAGS = { tr: TR, en: GB, de: DE } as const;

export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const current = useLocale() as Locale;
  const router = useRouter();
  const reduce = useReducedMotion();
  const [, startTransition] = useTransition();
  const [overlay, setOverlay] = useState<Locale | null>(null);

  function select(next: Locale) {
    if (next === current) return;
    writeLocaleCookie(next);
    setOverlay(next);
    startTransition(() => router.refresh());
    window.setTimeout(() => setOverlay(null), reduce ? 350 : 900);
  }

  const Overlay = overlay ? FLAGS[overlay] : null;

  return (
    <>
      <div role="group" aria-label={t("label")} className="flex items-center gap-1 rounded-full border bg-card/60 p-1">
        {locales.map((code) => {
          const Flag = FLAGS[code];
          const active = code === current;
          return (
            <button
              key={code}
              type="button"
              onClick={() => select(code)}
              aria-pressed={active}
              aria-label={t(code)}
              title={t(code)}
              className={cn(
                "grid size-8 place-items-center rounded-full transition-[transform,opacity] active:scale-[0.92]",
                active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100",
              )}
            >
              <Flag className="h-4 w-6 rounded-[3px]" aria-hidden />
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {Overlay && (
          <motion.div
            key={overlay}
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.25 }}
          >
            <motion.div
              initial={reduce ? false : { scale: 0.6, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={reduce ? undefined : { scale: 1.15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-border"
            >
              <Overlay className="h-32 w-48" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
