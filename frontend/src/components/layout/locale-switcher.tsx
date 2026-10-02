"use client";

import { useState, useTransition, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
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
import { useReducedMotionPreference } from "@/lib/preferences/motion";

export const FLAGS: Record<Locale, ComponentType<{ className?: string; title?: string }>> = { tr: TR, en: GB, de: DE };

// The flip: a beat on the old flag, then a half-second turn to the new one.
const FLIP_DELAY = 0.35;
const FLIP_DURATION = 0.7;
// The overlay stays at least this long (ms), so a fast refresh never cuts the turn short.
const MIN_SHOWN = 1400;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The one way the language changes (header menu and Settings page). The choice lives in the NEXT_LOCALE cookie and
 * the page refreshes; `overlay` is the flag-turning screen that covers the refresh and must be rendered by the caller.
 */
export function useLocaleSelection() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const reduce = useReducedMotionPreference();
  const [pending, startTransition] = useTransition();
  const [flip, setFlip] = useState<{ from: Locale; to: Locale } | null>(null);
  const [holding, setHolding] = useState(false);

  function select(next: string) {
    if (next === current || pending || flip) return;
    const target = next as Locale;
    setFlip({ from: current, to: target });
    setHolding(true);
    window.setTimeout(() => setHolding(false), reduce ? 0 : MIN_SHOWN);
    writeLocaleCookie(target);
    startTransition(() => router.refresh());
  }

  const overlay = (
    <LocaleOverlay flip={flip} shown={flip !== null && (pending || holding)} reduce={reduce} onExited={() => setFlip(null)} />
  );
  return { current, select, overlay };
}

/**
 * Flag-based locale menu. While the page refreshes, a blurred overlay shows the current language's flag, which
 * turns over like a card to reveal the chosen one; it stays until the refresh is done and the turn has played,
 * then clears itself once its own exit animation finishes.
 */
export function LocaleSwitcher({
  triggerClassName,
  hideLabelOnMobile,
}: {
  triggerClassName?: string;
  /** Drops the "TR"/"EN"/"DE" text (flag + caret only) below `sm`, for tight navbar layouts. */
  hideLabelOnMobile?: boolean;
}) {
  const t = useTranslations("common.language");
  const { current, select, overlay } = useLocaleSelection();
  const CurrentFlag = FLAGS[current];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("label")}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1.5 px-2 font-medium", triggerClassName)}
        >
          <CurrentFlag className="h-3.5 w-5 rounded-[2px]" title={t(current)} />
          <span className={cn("uppercase", hideLabelOnMobile && "max-sm:hidden")}>{current}</span>
          <CaretDown size={12} weight="bold" aria-hidden="true" className="opacity-60" />
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

      {overlay}
    </>
  );
}

function LocaleOverlay({ flip, shown, reduce, onExited }: {
  flip: { from: Locale; to: Locale } | null;
  shown: boolean;
  reduce: boolean;
  onExited: () => void;
}) {
  const t = useTranslations("common.language");
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence onExitComplete={onExited}>
            {shown && flip && (
              <motion.div
                key="locale-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="fixed inset-0 z-100 grid place-items-center bg-background/40 backdrop-blur-md"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
                  className="flex flex-col items-center gap-4 perspective-[900px]"
                >
                  <FlagCard from={flip.from} to={flip.to} reduce={reduce} />
                  {/* Both names stacked in one cell; they swap at the turn's midpoint. */}
                  <p className="grid text-base font-semibold text-foreground">
                    <Label text={t(flip.from)} visible={false} delay={reduce ? 0 : FLIP_DELAY + FLIP_DURATION / 2} />
                    <Label text={t(flip.to)} visible delay={reduce ? 0 : FLIP_DELAY + FLIP_DURATION / 2} />
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Two flags back to back; the card turns 180° from the old one to the new one. */
function FlagCard({ from, to, reduce }: { from: Locale; to: Locale; reduce: boolean }) {
  const Front = FLAGS[from];
  const Back = FLAGS[to];
  const face = "absolute inset-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/10 backface-hidden";
  return (
    <motion.div
      className="relative h-24 w-36 transform-3d"
      initial={{ rotateY: reduce ? 180 : 0 }}
      animate={{ rotateY: 180, scale: reduce ? 1 : [1, 1, 1.12, 1] }}
      transition={
        reduce
          ? { duration: 0 }
          : { delay: FLIP_DELAY, duration: FLIP_DURATION, ease: [0.65, 0, 0.35, 1], scale: { delay: FLIP_DELAY, duration: FLIP_DURATION, times: [0, 0.05, 0.5, 1] } }
      }
    >
      <span className={face}>
        <Front className="size-full" />
      </span>
      <span className={cn(face, "rotate-y-180")}>
        <Back className="size-full" />
      </span>
    </motion.div>
  );
}

function Label({ text, visible, delay }: { text: string; visible: boolean; delay: number }) {
  return (
    <motion.span
      className="col-start-1 row-start-1 text-center"
      initial={{ opacity: visible ? 0 : 1 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      {text}
    </motion.span>
  );
}
