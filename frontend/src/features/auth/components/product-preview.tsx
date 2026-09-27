"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CalendarBlank, CheckCircle, Flag } from "@phosphor-icons/react";
import { ActivityFeed, AnimatedTaskFlow, Avatar, useTaskFlow } from "./animated-task-flow";

const BASE_PROGRESS = 62;
const DONE_PROGRESS = 78;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A reduced PDA project view that plays one delivery through. Purely
 * illustrative, so hidden from assistive tech; the headline beside it carries
 * the message. Two faded panels behind it add depth without extra content.
 */
export function ProductPreview() {
  const t = useTranslations("preview");
  const { step, visible } = useTaskFlow();
  const progress = step >= 5 ? DONE_PROGRESS : BASE_PROGRESS;
  const ready = step >= 6;

  return (
    <motion.div
      aria-hidden
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
      className="relative mb-6 w-full max-w-2xl select-none sm:mb-8"
    >
      <div className="absolute inset-x-5 -bottom-3 top-6 rounded-xl border bg-card/50" />
      <div className="absolute inset-x-10 -bottom-6 top-12 rounded-xl border bg-card/30" />

      <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)]">
        <div className="flex items-center gap-1.5 border-b px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">PDA</span>
          <span>/</span>
          <span>{t("projects")}</span>
          <span>/</span>
          <span className="text-foreground">PDA Web Platform</span>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">PDA Web Platform</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="flex -space-x-1.5">
                    <Avatar name="Alper" tone="a" />
                    <Avatar name="Hamza" tone="b" />
                    <Avatar name="Elif" tone="c" />
                  </span>
                  {t("members", { count: 8 })}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarBlank size={14} />
                  {t("due")}
                </span>
              </div>
            </div>

            <div className="w-28 shrink-0 text-right sm:w-36">
              <p className="text-xs text-muted-foreground">{t("progress")}</p>
              <p className="font-heading text-lg font-semibold tabular-nums">{progress}%</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full origin-left rounded-full bg-primary"
                  animate={{ scaleX: progress / 100 }}
                  initial={false}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              </div>
            </div>
          </div>

          <AnimatedTaskFlow step={step} />

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="hidden sm:block">
              <ActivityFeed step={step} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("milestone")}</p>
              <div className="rounded-lg border p-3 sm:h-[9.5rem]">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Flag size={14} weight="fill" className="text-primary" />
                  v1.0
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("due")}</p>
                <div className="relative mt-4 h-6">
                  <AnimatePresence initial={false}>
                    <motion.p
                      key={ready ? "ready" : "left"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className={
                        ready
                          ? "absolute inset-y-0 left-0 inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 text-xs font-medium text-success"
                          : "absolute inset-y-0 left-0 flex items-center text-xs font-medium tabular-nums"
                      }
                    >
                      {ready && <CheckCircle size={14} weight="fill" />}
                      {ready ? t("delivered") : t("daysLeft", { count: 5 })}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        animate={{ opacity: step === 2 ? 1 : 0, y: step === 2 ? 0 : 8 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="absolute -top-4 right-3 hidden items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_12px_24px_-12px_rgb(0_0_0/0.6)] md:flex"
      >
        <Bell size={14} className="text-primary" />
        {t("notification", { user: "Hamza", task: "PDA-42" })}
      </motion.div>
    </motion.div>
  );
}
