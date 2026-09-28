"use client";

import { useState, useTransition, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import DE from "country-flag-icons/react/3x2/DE";
import GB from "country-flag-icons/react/3x2/GB";
import TR from "country-flag-icons/react/3x2/TR";
import { locales, type Locale } from "@/i18n/config";
import { writeLocaleCookie } from "@/i18n/locale-cookie";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const FLAGS: Record<Locale, ComponentType<{ className?: string; title?: string }>> = { tr: TR, en: GB, de: DE };

/**
 * Flag-based locale menu. The choice lives in the NEXT_LOCALE cookie; a
 * blurred flip overlay covers the page for as long as the refresh is
 * pending, then clears itself once its own exit animation finishes.
 */
export function LocaleSwitcher({ triggerClassName }: { triggerClassName?: string }) {
  const t = useTranslations("common.language");
  const current = useLocale() as Locale;
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<Locale | null>(null);

  function select(next: string) {
    if (next === current || pending) return;
    const target = next as Locale;
    setSwitchingTo(target);
    writeLocaleCookie(target);
    startTransition(() => router.refresh());
  }

  const CurrentFlag = FLAGS[current];
  const OverlayFlag = switchingTo ? FLAGS[switchingTo] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("label")}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1.5 px-2 font-medium", triggerClassName)}
        >
          <CurrentFlag className="h-3.5 w-5 rounded-[2px]" title={t(current)} />
          <span className="uppercase">{current}</span>
          <CaretDown size={12} weight="bold" className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {locales.map((code) => {
            const Flag = FLAGS[code];
            return (
              <DropdownMenuItem key={code} onClick={() => select(code)} className="gap-2">
                <Flag className="h-3.5 w-5 rounded-[2px]" />
                {t(code)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence onExitComplete={() => setSwitchingTo(null)}>
            {pending && OverlayFlag && switchingTo && (
              <motion.div
                key="locale-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="fixed inset-0 z-100 grid place-items-center bg-background/40 backdrop-blur-md"
              >
                <motion.div
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ perspective: 600 }}
                  className="flex flex-col items-center gap-3"
                >
                  <OverlayFlag className="h-14 w-20 rounded-md shadow-2xl" />
                  <p className="text-sm font-medium text-foreground">{t(switchingTo)}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
