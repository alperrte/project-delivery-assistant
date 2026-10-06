"use client";

import { useTranslations } from "next-intl";
import { CheckCircle, Clock, Lock, Prohibit, Tray } from "@phosphor-icons/react";
import { CircleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { cn } from "@/lib/utils";
import { deadlineState } from "../deadline";
import { useTaskFormat } from "../format";
import type { LabelRef, PersonRef, Task, TaskPriority, TaskStatus } from "../types";
import {
  deadlineToneClass,
  labelBadgeClass,
  labelDotClass,
  priorityBadgeClass,
  priorityDotClass,
  statusBadgeClass,
  statusDotClass,
} from "../workflow";

const CHIP = "inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap";

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", statusDotClass(status), className)} />;
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const t = useTranslations("tasks.common.status");
  return (
    <span className={cn(CHIP, statusBadgeClass(status), className)}>
      <StatusDot status={status} className="size-1.5" />
      {t(status)}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const t = useTranslations("tasks.common.priority");
  return (
    <span className={cn(CHIP, priorityBadgeClass(priority), className)}>
      <PriorityIndicator priority={priority} />
      {t(priority)}
    </span>
  );
}

/** One marker for forms, details, filters and cards; critical also carries a shape cue. */
export function PriorityIndicator({ priority, className }: { priority: TaskPriority; className?: string }) {
  return <span aria-hidden="true" data-priority={priority} className={cn("inline-flex size-3.5 shrink-0 items-center justify-center", className)}>
    {priority === "CRITICAL"
      ? <CircleAlert data-priority-alert className="size-full text-destructive" strokeWidth={2.5} />
      : <span className={cn("size-2 rounded-full", priorityDotClass(priority))} />}
  </span>;
}

export function LabelChip({ label, className }: { label: Pick<LabelRef, "name" | "color">; className?: string }) {
  return (
    <span className={cn(CHIP, "border", labelBadgeClass(label.color), className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", labelDotClass(label.color))} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

export function LabelList({ labels, max = 3 }: { labels: LabelRef[]; max?: number }) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((label) => (
        <LabelChip key={label.id} label={label} />
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
    </span>
  );
}

export function PointsBadge({ points, className }: { points: number | null; className?: string }) {
  const t = useTranslations("tasks.common");
  if (points === null) return null;
  return (
    <span
      title={t("points", { count: points })}
      className={cn(CHIP, "min-w-5 justify-center border border-border bg-muted px-1.5 tabular-nums text-muted-foreground", className)}
    >
      <span className="sr-only">{t("points", { count: points })}</span>
      <span aria-hidden="true">{points}</span>
    </span>
  );
}

/** The deadline with its tone: a late open task is destructive, one due within a day is a warning. Done tasks stay quiet. */
export function DeadlineChip({ task, className }: { task: Pick<Task, "deadlineAt" | "status">; className?: string }) {
  const format = useTaskFormat();
  const t = useTranslations("tasks.common");
  if (!task.deadlineAt) return null;
  const done = task.status === "DONE";
  const state = done ? "upcoming" : deadlineState(task.deadlineAt);
  const text = format.dateTime(task.deadlineAt);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums whitespace-nowrap", deadlineToneClass(state), className)} title={done ? text : format.countdown(task.deadlineAt)}>
      <Clock size={13} weight={state === "upcoming" ? "regular" : "fill"} aria-hidden="true" />
      <span>{text}</span>
      {!done && state === "overdue" && <span className="sr-only">{t("deadline.overdue")}</span>}
      {!done && state === "soon" && <span className="sr-only">{t("deadline.soon")}</span>}
    </span>
  );
}

export function BlockedMark({ task, className }: { task: Pick<Task, "blocked" | "hasOpenBlockers">; className?: string }) {
  const t = useTranslations("tasks.common");
  if (!task.blocked && !task.hasOpenBlockers) return null;
  return (
    <span
      className={cn(CHIP, "border border-destructive/25 bg-destructive/10 text-destructive", className)}
      title={task.blocked ? t("blocked.flag") : t("blocked.byTask")}
    >
      <Prohibit size={12} weight="bold" aria-hidden="true" />
      {t("blocked.label")}
    </span>
  );
}

export function PoolMark({ task, className }: { task: Pick<Task, "pool">; className?: string }) {
  const t = useTranslations("tasks.common");
  if (!task.pool?.open) return null;
  return (
    <span className={cn(CHIP, "border border-primary/25 bg-primary/10 text-primary", className)}>
      <Tray size={12} weight="bold" aria-hidden="true" />
      {task.pool.teamName ?? t("pool.project")}
    </span>
  );
}

/** Small avatars (decorative) followed by a screen reader list of the names. */
export function AssigneeAvatars({ people, max = 3, className }: { people: PersonRef[]; max?: number; className?: string }) {
  const t = useTranslations("tasks.common");
  if (people.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{t("unassigned")}</span>;
  }
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="flex -space-x-1.5" aria-hidden="true">
        {shown.map((person) => (
          <Avatar key={person.userId} name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-6 bg-muted text-[10px] text-foreground" />
        ))}
        {extra > 0 && (
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2 ring-card">
            +{extra}
          </span>
        )}
      </span>
      <span className="sr-only">{people.map((person) => person.nickname ?? "?").join(", ")}</span>
    </span>
  );
}

/** `2/5` with a thin bar; used for subtasks and checklists. */
export function ProgressPill({ done, total, label, icon }: { done: number; total: number; label: string; icon?: "check" | "lock" }) {
  if (total <= 0) return null;
  const complete = done >= total;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", complete ? "text-success" : "text-muted-foreground")} title={label}>
      {icon === "lock" ? <Lock size={12} aria-hidden="true" /> : <CheckCircle size={13} weight={complete ? "fill" : "regular"} aria-hidden="true" />}
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
