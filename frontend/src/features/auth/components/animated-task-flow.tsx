"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type Status = "todo" | "inProgress" | "inReview" | "done";

/** Steps of one demo cycle; each entry is when (ms after the previous one) the next step starts. */
const STEP_DELAYS = [1400, 1500, 1600, 1800, 1500, 1500];
const LAST_STEP = STEP_DELAYS.length;
const HOLD_MS = 3200;
const FADE_MS = 450;

/**
 * 0 baseline, 1 task appears, 2 assigned, 3 in progress, 4 in review, 5 done, 6 delivered.
 * Reduced motion shows the finished state and never advances.
 */
export function useTaskFlow() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    let t = 0;
    STEP_DELAYS.forEach((delay, i) => {
      t += delay;
      timers.push(window.setTimeout(() => setStep(i + 1), t));
    });
    t += HOLD_MS;
    timers.push(window.setTimeout(() => setVisible(false), t));
    timers.push(
      window.setTimeout(() => {
        setStep(0);
        setVisible(true);
        setCycle((c) => c + 1);
      }, t + FADE_MS),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduce, cycle]);

  return { step: reduce ? LAST_STEP : step, visible: reduce ? true : visible };
}

const STATUS_STYLE: Record<Status, string> = {
  todo: "border-border bg-secondary text-muted-foreground",
  inProgress: "border-primary/30 bg-primary/10 text-primary",
  inReview: "border-border bg-card text-foreground",
  done: "border-success/30 bg-success/10 text-success",
};

function StatusChip({ status }: { status: Status }) {
  const t = useTranslations("preview.status");
  return (
    <span className="relative block h-6 w-[6.75rem]">
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "absolute inset-y-0 right-0 inline-flex items-center rounded-md border px-2 text-xs font-medium",
            STATUS_STYLE[status],
          )}
        >
          {t(status)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Avatar({ name, tone }: { name: string; tone: "a" | "b" | "c" }) {
  const tones = {
    a: "bg-primary text-primary-foreground",
    b: "bg-secondary text-secondary-foreground",
    c: "bg-accent text-accent-foreground",
  } as const;
  return (
    <span
      className={cn(
        "grid size-6 place-items-center rounded-full text-[0.65rem] font-semibold ring-2 ring-card",
        tones[tone],
      )}
    >
      {name[0]}
    </span>
  );
}

function statusAt(step: number): Status {
  if (step >= 5) return "done";
  if (step >= 4) return "inReview";
  if (step >= 3) return "inProgress";
  return "todo";
}

const BASE_TASKS: { id: string; key: "t39" | "t40" | "t41"; status: Status }[] = [
  { id: "PDA-39", key: "t39", status: "done" },
  { id: "PDA-40", key: "t40", status: "done" },
  { id: "PDA-41", key: "t41", status: "inReview" },
];

export function AnimatedTaskFlow({ step }: { step: number }) {
  const t = useTranslations("preview");
  const status = statusAt(step);

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("tasks")}</p>
      <ul className="divide-y divide-border rounded-lg border">
        {BASE_TASKS.map((task) => (
          <li key={task.id} className="flex h-11 items-center gap-3 px-3">
            <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{task.id}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{t(task.key)}</span>
            <StatusChip status={task.status} />
          </li>
        ))}
        {/* The row always occupies its space, so its appearance never shifts the layout. */}
        <motion.li
          animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 6 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-11 items-center gap-3 px-3"
        >
          <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">PDA-42</span>
          <span className="min-w-0 flex-1 truncate text-sm">{t("t42")}</span>
          <span className="flex -space-x-1.5">
            <motion.span
              animate={{ opacity: step >= 2 ? 1 : 0, scale: step >= 2 ? 1 : 0.7 }}
              transition={{ duration: 0.25 }}
            >
              <Avatar name="Alper" tone="a" />
            </motion.span>
            <motion.span
              animate={{ opacity: step >= 2 ? 1 : 0, scale: step >= 2 ? 1 : 0.7 }}
              transition={{ duration: 0.25, delay: 0.08 }}
            >
              <Avatar name="Hamza" tone="b" />
            </motion.span>
          </span>
          <StatusChip status={status} />
        </motion.li>
      </ul>
    </div>
  );
}

type Entry = { key: string; minStep: number; render: (t: ReturnType<typeof useTranslations>) => string };

const ENTRIES: Entry[] = [
  { key: "deadline", minStep: 0, render: (t) => t("deadline") },
  { key: "assigned", minStep: 2, render: (t) => t("assigned", { user: "Hamza", task: "PDA-42" }) },
  { key: "progress", minStep: 3, render: (t) => t("moved", { user: "Alper", task: "PDA-42", status: t("status.inProgress") }) },
  { key: "review", minStep: 4, render: (t) => t("moved", { user: "Alper", task: "PDA-42", status: t("status.inReview") }) },
  { key: "done", minStep: 5, render: (t) => t("moved", { user: "Alper", task: "PDA-42", status: t("status.done") }) },
];

/** Newest first, capped at four rows in a fixed-height list. */
export function ActivityFeed({ step }: { step: number }) {
  const t = useTranslations("preview");
  const shown = ENTRIES.filter((e) => step >= e.minStep).reverse().slice(0, 4);

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("activity")}</p>
      <ul className="h-[9.5rem] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((e) => (
            <motion.li
              key={e.key}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-[2.375rem] items-center gap-2.5 text-[0.8rem] text-muted-foreground"
            >
              <span aria-hidden className="size-1 shrink-0 rounded-full bg-border" />
              <span className="truncate">{e.render(t)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
