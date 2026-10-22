"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretRight, CheckCircle, Clock, Lock, Prohibit, Tray } from "@phosphor-icons/react";
import { CircleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { profilePhotoSrc } from "@/features/account/api";
import { cn } from "@/lib/utils";
import { deadlineState } from "../deadline";
import { useTaskFormat } from "../format";
import type { AssignmentRef, LabelRef, PersonRef, Task, TaskPriority, TaskStatus } from "../types";
import { assignmentGroups, uniquePeople } from "../assignment";
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

function PersonAvatars({ people, max }: { people: PersonRef[]; max: number }) {
  const t = useTranslations("tasks.common");
  const shown = people.slice(0, max);
  return <span className="flex -space-x-1.5" aria-hidden="true">
    {shown.map(person => <Avatar key={person.userId} name={person.nickname ?? t("unknownUser")} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-6 bg-muted text-[10px] text-foreground" />)}
    {people.length > shown.length && <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2 ring-card">+{people.length - shown.length}</span>}
  </span>;
}

/** One keyboard/touch/hover disclosure; names stay visible and the complete relationships are accessible. */
function AssignmentSummary({ assignees, assigners = [], assignmentDetails, max = 3, className }: { assignees: PersonRef[]; assigners?: PersonRef[]; assignmentDetails?: AssignmentRef[]; max?: number; className?: string }) {
  const t = useTranslations("tasks.common");
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const triggerId = `${tooltipId}-trigger`;
  const people = uniquePeople(assignees);
  const actors = uniquePeople(assigners);
  if (people.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{t("unassigned")}</span>;
  }
  const name = (person: PersonRef) => person.nickname ?? `${t("unknownUser")} (${person.userId})`;
  const names = (list: PersonRef[]) => list.map(name).join(", ");
  const groups = assignmentGroups(people, actors, assignmentDetails);
  const text = groups
    ? groups.map(group => group.actor ? t("assignedBy", { assigner: name(group.actor), assignees: names(group.people) }) : t("assignmentRecipients", { names: names(group.people) })).join("\n")
    : actors.length ? `${t("assignmentActors", { names: names(actors) })}\n${t("assignmentRecipients", { names: names(people) })}` : t("assignmentRecipients", { names: names(people) });
  return <Tooltip open={open} triggerId={triggerId} onOpenChange={setOpen}>
    <TooltipTrigger id={triggerId} type="button" closeOnClick={false} onClick={() => setOpen(true)} aria-label={text} aria-describedby={open ? tooltipId : undefined} className={cn("relative z-10 inline-flex min-h-9 min-w-0 max-w-full items-center gap-1 rounded-md text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <span data-assignment-summary title={text} className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
        {actors.length > 0 && <span data-assigner className="inline-flex items-center gap-1" aria-hidden="true">
          <PersonAvatars people={actors} max={1} />
          <span className="assign-flow"><span className="assign-flow-track" /><CaretRight weight="bold" size={10} /></span>
        </span>}
        <PersonAvatars people={people} max={Math.max(1, max)} />
        <span className="max-w-28 truncate text-muted-foreground" aria-hidden="true">{people[0].nickname ?? t("unknownUser")}{people.length > 1 ? ` +${people.length - 1}` : ""}</span>
        <span className="sr-only">{text}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent id={tooltipId} role="tooltip" className="block max-w-[min(24rem,calc(100vw-2rem))] whitespace-pre-line break-words">{text}</TooltipContent>
  </Tooltip>;
}

export function AssigneeAvatars({ people, max = 3, className, interactive = true }: { people: PersonRef[]; max?: number; className?: string; interactive?: boolean }) {
  const t = useTranslations("tasks.common");
  if (!interactive) {
    const recipients = uniquePeople(people);
    const names = recipients.map(person => person.nickname ?? t("unknownUser")).join(", ");
    return <span className={cn("inline-flex min-w-0 items-center gap-1 text-xs", className)} title={names || t("unassigned")}>
      <PersonAvatars people={recipients} max={max} /><span className="sr-only">{names || t("unassigned")}</span>
    </span>;
  }
  return <AssignmentSummary assignees={people} max={max} className={className} />;
}

export function AssignmentFlow(props: { assigners: PersonRef[]; assignees: PersonRef[]; assignmentDetails?: AssignmentRef[]; max?: number; className?: string }) {
  return <AssignmentSummary {...props} />;
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
